/**
 * Implementação in-memory do ProposalRepository (contrato em domain.ts).
 *
 * É a implementação de referência do contrato — usada nos testes e como default enquanto a camada
 * SQLite (node:sqlite, Disk da Render via DATA_DIR) não é plugada. A troca é drop-in: qualquer backend
 * que implemente ProposalRepository serve às rotas sem alterá-las (§1.1 do doc 10).
 *
 * Nota honesta: in-memory NÃO persiste entre reinícios do processo. Em produção, trocar por SQLite.
 */
import { randomUUID } from 'node:crypto';
import {
  type Proposal,
  type ProposalRepository,
  type CreateProposalArgs,
  type AuditEntry,
  VersionConflictError,
  NotFoundError,
} from './domain.js';

export function createMemoryRepository(now: () => string = () => new Date().toISOString()): ProposalRepository {
  const proposals = new Map<string, Proposal>();
  const audits = new Map<string, AuditEntry[]>();
  let seq = 0;

  function appendAudit(proposalId: string, a: Omit<AuditEntry, 'id' | 'proposalId' | 'at'>): void {
    const entry: AuditEntry = { ...a, id: randomUUID(), proposalId, at: now() };
    const list = audits.get(proposalId) ?? [];
    list.push(entry);
    audits.set(proposalId, list);
  }

  return {
    async nextSequence(): Promise<number> {
      return ++seq;
    },

    async create(args: CreateProposalArgs, audit): Promise<Proposal> {
      if (proposals.has(args.id)) throw new Error(`proposta já existe: ${args.id}`);
      const ts = now();
      const p: Proposal = {
        id: args.id,
        version: 1,
        status: 'rascunho_comercial',
        ownerEmail: args.ownerEmail,
        commercial: args.commercial,
        createdAt: ts,
        updatedAt: ts,
      };
      proposals.set(p.id, p);
      appendAudit(p.id, audit);
      return p;
    },

    async get(id: string): Promise<Proposal | null> {
      return proposals.get(id) ?? null;
    },

    async list(): Promise<readonly Proposal[]> {
      return [...proposals.values()].sort((a, b) => (a.id < b.id ? 1 : -1));
    },

    async update(id, expectedVersion, patch, audit): Promise<Proposal> {
      const current = proposals.get(id);
      if (!current) throw new NotFoundError(id);
      if (current.version !== expectedVersion) {
        throw new VersionConflictError(id, expectedVersion, current.version);
      }
      const next: Proposal = {
        ...current,
        ...('status' in patch && patch.status ? { status: patch.status } : {}),
        ...('commercial' in patch && patch.commercial ? { commercial: patch.commercial } : {}),
        ...('technical' in patch && patch.technical !== undefined ? { technical: patch.technical } : {}),
        ...('snapshot' in patch && patch.snapshot !== undefined ? { snapshot: patch.snapshot } : {}),
        version: current.version + 1,
        updatedAt: now(),
      };
      proposals.set(id, next);
      appendAudit(id, audit);
      return next;
    },

    async audit(id: string): Promise<readonly AuditEntry[]> {
      return [...(audits.get(id) ?? [])];
    },
  };
}
