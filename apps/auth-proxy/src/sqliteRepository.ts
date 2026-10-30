/**
 * Implementação SQLite do ProposalRepository (contrato em domain.ts), via `node:sqlite` (nativo do
 * Node 22+, sem dependência nativa extra). Persiste em DATA_DIR/bondly.db — na Render, um Disk montado.
 *
 * Mesmo contrato do memoryRepository: lock otimista (version) e auditoria append-only na MESMA
 * operação. Trocar por Postgres depois é reimplementar esta interface, sem tocar api.ts/server.ts.
 *
 * Nota: `node:sqlite` é experimental no Node 22 (emite ExperimentalWarning). Importado dinamicamente
 * para não quebrar ambientes sem ele — o factory (createRepository) cai para in-memory se faltar.
 */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  type Proposal,
  type ProposalRepository,
  type CreateProposalArgs,
  type AuditEntry,
  type SlaEventRow,
  type WorkflowState,
  VersionConflictError,
  NotFoundError,
} from './domain.js';

// Tipagem mínima do subconjunto de node:sqlite que usamos (evita depender de @types instáveis).
interface SqliteStatement {
  run(...params: unknown[]): { changes: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

function rowToProposal(r: Record<string, unknown>): Proposal {
  return {
    id: String(r.id),
    version: Number(r.version),
    status: String(r.status) as WorkflowState,
    ownerEmail: String(r.owner_email),
    commercial: JSON.parse(String(r.commercial ?? '{}')),
    ...(r.technical != null ? { technical: JSON.parse(String(r.technical)) } : {}),
    ...(r.snapshot != null ? { snapshot: JSON.parse(String(r.snapshot)) } : {}),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function createSqliteRepository(
  dataDir: string,
  now: () => string = () => new Date().toISOString(),
): Promise<ProposalRepository> {
  // `node:sqlite` é builtin novo (Node 22+). Carregamos via createRequire para escapar da
  // transformação ESM do Vite/Vitest (que reescreve o especificador 'node:sqlite' e falha ao
  // resolvê-lo). Em runtime de produção (node dist/server.js) isto é um require nativo direto.
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url) as (id: string) => unknown;
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => SqliteDb;
  };
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'bondly.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      commercial TEXT NOT NULL,
      technical TEXT,
      snapshot TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT,
      note TEXT,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seq (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
    INSERT OR IGNORE INTO seq (k, v) VALUES ('proposal', 0);
    CREATE TABLE IF NOT EXISTS sla_events (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      at INTEGER NOT NULL,
      by_email TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sla_events_proposal ON sla_events (proposal_id, at);
  `);

  function appendAudit(a: Omit<AuditEntry, 'id' | 'at'>): void {
    db.prepare(
      `INSERT INTO audit (id, proposal_id, actor_email, role, action, from_state, to_state, note, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), a.proposalId, a.actorEmail, a.role, a.action, a.fromState ?? null, a.toState ?? null, a.note ?? null, now());
  }

  return {
    async nextSequence(): Promise<number> {
      db.prepare(`UPDATE seq SET v = v + 1 WHERE k = 'proposal'`).run();
      const row = db.prepare(`SELECT v FROM seq WHERE k = 'proposal'`).get();
      return Number(row?.v ?? 0);
    },

    async create(args: CreateProposalArgs, audit): Promise<Proposal> {
      const existing = db.prepare(`SELECT id FROM proposals WHERE id = ?`).get(args.id);
      if (existing) throw new Error(`proposta já existe: ${args.id}`);
      const ts = now();
      db.prepare(
        `INSERT INTO proposals (id, version, status, owner_email, commercial, technical, snapshot, created_at, updated_at)
         VALUES (?, 1, 'rascunho_comercial', ?, ?, NULL, NULL, ?, ?)`,
      ).run(args.id, args.ownerEmail, JSON.stringify(args.commercial), ts, ts);
      appendAudit({ ...audit, proposalId: args.id });
      return rowToProposal(db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(args.id)!);
    },

    async get(id: string): Promise<Proposal | null> {
      const r = db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id);
      return r ? rowToProposal(r) : null;
    },

    async list(): Promise<readonly Proposal[]> {
      return db.prepare(`SELECT * FROM proposals ORDER BY id DESC`).all().map(rowToProposal);
    },

    async update(id, expectedVersion, patch, audit): Promise<Proposal> {
      const current = db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id);
      if (!current) throw new NotFoundError(id);
      const curVersion = Number(current.version);
      if (curVersion !== expectedVersion) throw new VersionConflictError(id, expectedVersion, curVersion);
      const next = {
        status: patch.status ?? String(current.status),
        commercial: 'commercial' in patch && patch.commercial ? JSON.stringify(patch.commercial) : String(current.commercial),
        technical: 'technical' in patch && patch.technical !== undefined ? JSON.stringify(patch.technical) : (current.technical as string | null),
        snapshot: 'snapshot' in patch && patch.snapshot !== undefined ? JSON.stringify(patch.snapshot) : (current.snapshot as string | null),
      };
      // UPDATE guardado por versão (lock otimista no próprio SQL — defende contra corrida)
      const res = db
        .prepare(
          `UPDATE proposals SET version = version + 1, status = ?, commercial = ?, technical = ?, snapshot = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .run(next.status, next.commercial, next.technical, next.snapshot, now(), id, expectedVersion);
      if (Number(res.changes) === 0) {
        const actual = Number(db.prepare(`SELECT version FROM proposals WHERE id = ?`).get(id)?.version ?? -1);
        throw new VersionConflictError(id, expectedVersion, actual);
      }
      appendAudit({ ...audit, proposalId: id });
      return rowToProposal(db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id)!);
    },

    async audit(id: string): Promise<readonly AuditEntry[]> {
      return db
        .prepare(`SELECT * FROM audit WHERE proposal_id = ? ORDER BY at ASC`)
        .all(id)
        .map((r) => ({
          id: String(r.id),
          proposalId: String(r.proposal_id),
          actorEmail: String(r.actor_email),
          role: String(r.role) as AuditEntry['role'],
          action: String(r.action),
          ...(r.from_state != null ? { fromState: String(r.from_state) as WorkflowState } : {}),
          ...(r.to_state != null ? { toState: String(r.to_state) as WorkflowState } : {}),
          ...(r.note != null ? { note: String(r.note) } : {}),
          at: String(r.at),
        }));
    },

    async appendSlaEvent(event: Omit<SlaEventRow, 'id'>): Promise<void> {
      db.prepare(
        `INSERT INTO sla_events (id, proposal_id, kind, at, by_email, payload) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), event.proposalId, event.kind, event.at, event.by, JSON.stringify(event.payload));
    },

    async slaEvents(proposalId: string): Promise<readonly SlaEventRow[]> {
      return db
        .prepare(`SELECT * FROM sla_events WHERE proposal_id = ? ORDER BY at ASC`)
        .all(proposalId)
        .map((r) => ({
          id: String(r.id),
          proposalId: String(r.proposal_id),
          kind: String(r.kind) as SlaEventRow['kind'],
          at: Number(r.at),
          by: String(r.by_email),
          payload: JSON.parse(String(r.payload ?? '{}')) as Record<string, unknown>,
        }));
    },
  };
}

/**
 * Factory de repositório: SQLite quando DATA_DIR está setado E `node:sqlite` disponível; senão
 * in-memory (dev/teste). O servidor usa isto no boot — a escolha de backend não vaza para as rotas.
 */
export async function createRepository(env: NodeJS.ProcessEnv = process.env): Promise<{
  repo: ProposalRepository;
  backend: 'sqlite' | 'memory';
}> {
  const dataDir = env.DATA_DIR;
  if (dataDir) {
    try {
      const repo = await createSqliteRepository(dataDir);
      return { repo, backend: 'sqlite' };
    } catch (e) {
      console.error(JSON.stringify({ evt: 'sqlite_unavailable', msg: (e as Error).message }));
    }
  }
  const { createMemoryRepository } = await import('./memoryRepository.js');
  return { repo: createMemoryRepository(), backend: 'memory' };
}
