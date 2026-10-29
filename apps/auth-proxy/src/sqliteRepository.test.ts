import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteRepository } from './sqliteRepository.js';
import { VersionConflictError, type ProposalRepository } from './domain.js';

// node:sqlite existe no Node 22+. Detecta pela versão para não depender de resolução do bundler.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const available = nodeMajor >= 22;

describe.skipIf(!available)('sqliteRepository — contrato (mesmo do in-memory)', () => {
  let dir: string;
  let repo: ProposalRepository;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'bondly-sql-'));
    repo = await createSqliteRepository(dir);
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('cria, lê, atualiza sob lock otimista e audita (persistido em disco)', async () => {
    const seq = await repo.nextSequence();
    const id = `BONDLY-2027-${String(seq).padStart(6, '0')}`;
    const p = await repo.create(
      { id, ownerEmail: 'ana@minu.co', commercial: { users: 50000 } },
      { actorEmail: 'ana@minu.co', role: 'business', action: 'proposal.create', toState: 'rascunho_comercial' },
    );
    expect(p.version).toBe(1);
    expect(p.status).toBe('rascunho_comercial');

    const upd = await repo.update(p.id, 1, { technical: { integrations: 3, verdict: 'ajustes' } }, { actorEmail: 'tec@minu.co', role: 'tech', action: 'proposal.edit_technical' });
    expect(upd.version).toBe(2);
    expect(upd.technical).toMatchObject({ integrations: 3, verdict: 'ajustes' });

    const audit = await repo.audit(p.id);
    expect(audit.length).toBe(2);
    expect(audit[0]?.action).toBe('proposal.create');
  });

  it('rejeita escrita com versão defasada', async () => {
    const seq = await repo.nextSequence();
    const id = `BONDLY-2027-${String(seq).padStart(6, '0')}`;
    await repo.create({ id, ownerEmail: 'ana@minu.co', commercial: {} }, { actorEmail: 'ana@minu.co', role: 'business', action: 'proposal.create' });
    await repo.update(id, 1, { commercial: { x: 1 } }, { actorEmail: 'ana@minu.co', role: 'business', action: 'proposal.edit_commercial' });
    await expect(repo.update(id, 1, { commercial: { x: 2 } }, { actorEmail: 'ana@minu.co', role: 'business', action: 'proposal.edit_commercial' })).rejects.toBeInstanceOf(VersionConflictError);
  });

  it('sequência é monotônica e persiste entre reaberturas do mesmo DATA_DIR', async () => {
    const a = await repo.nextSequence();
    const repo2 = await createSqliteRepository(dir); // reabre o MESMO banco
    const b = await repo2.nextSequence();
    expect(b).toBeGreaterThan(a);
  });
});
