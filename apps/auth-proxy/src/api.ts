/**
 * Camada de API /api/* (prompt §5/§6/§8) — PURA e testável sem servidor HTTP.
 *
 * Recebe a sessão já verificada, o método, o caminho, o corpo JSON parseado, o repositório e a config;
 * devolve { status, body?, session? }. O enforcement de RBAC roda AQUI, no servidor — o front nunca é
 * a fronteira. Payloads saem filtrados por papel (projection.ts). A máquina de estados da esteira
 * (/transition) é ligada no passo 5; aqui entregam-se identidade, 2º fator, CRUD de inputs e leitura.
 */
import type { ServerConfig } from './config.js';
import type { SessionData } from './session.js';
import { can, type Role } from './rbac.js';
import { verifyProfileCode } from './profileCodes.js';
import {
  type ProposalRepository,
  type CommercialInput,
  type TechnicalInput,
  VersionConflictError,
  NotFoundError,
  formatProposalId,
} from './domain.js';
import { projectProposal, projectAudit } from './projection.js';

export interface ApiResult {
  readonly status: number;
  readonly body?: unknown;
  /** quando presente, o servidor deve reemitir o cookie de sessão com estes dados (ex.: após unlock). */
  readonly session?: Omit<SessionData, 'exp'>;
}

function json(status: number, body: unknown): ApiResult {
  return { status, body };
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Trata uma rota /api/*. `session` é a sessão verificada (ou null). `body` é o JSON já parseado.
 * Retorna 401 sem sessão, 403 sem papel/ação, 409 em conflito de versão, 404 inexistente.
 */
export async function handleApi(args: {
  method: string;
  path: string;
  session: SessionData | null;
  body: unknown;
  repo: ProposalRepository;
  cfg: ServerConfig;
}): Promise<ApiResult> {
  const { method, path, session, body, repo, cfg } = args;

  if (!session) return json(401, { error: 'unauthenticated' });
  const role = session.role;

  // --- identidade (inclui papel atual) ---
  if (path === '/api/me' && method === 'GET') {
    return json(200, {
      email: session.email,
      name: session.name ?? null,
      picture: session.picture ?? null,
      domain: session.domain,
      role: role ?? null,
    });
  }

  // --- 2º fator: eleva a sessão a um papel (§7.2) ---
  if (path === '/api/profile/unlock' && method === 'POST') {
    const b = (body ?? {}) as { role?: unknown; code?: unknown };
    const reqRole = typeof b.role === 'string' ? b.role : '';
    const code = typeof b.code === 'string' ? b.code : '';
    const result = verifyProfileCode(reqRole, code, cfg.profileCodeHashes);
    if (!result.ok) {
      // mensagem genérica; motivo fica no log do servidor, não no corpo (anti-enumeração)
      return json(result.reason === 'unknown_role' ? 400 : 401, { error: 'unlock_failed' });
    }
    const next: Omit<SessionData, 'exp'> = {
      email: session.email,
      ...(session.name !== undefined ? { name: session.name } : {}),
      ...(session.picture !== undefined ? { picture: session.picture } : {}),
      domain: session.domain,
      role: result.role,
    };
    return { status: 200, body: { role: result.role }, session: next };
  }

  // A partir daqui, tudo exige um papel (2º fator cumprido).
  if (!role) return json(403, { error: 'profile_required' });

  // --- listar propostas ---
  if (path === '/api/proposals' && method === 'GET') {
    if (!can(role, 'proposal.read')) return json(403, { error: 'forbidden' });
    const all = await repo.list();
    return json(200, { proposals: all.map((p) => projectProposal(p, role)) });
  }

  // --- criar proposta (rascunho comercial) ---
  if (path === '/api/proposals' && method === 'POST') {
    if (!can(role, 'proposal.create')) return json(403, { error: 'forbidden' });
    const b = (body ?? {}) as { commercial?: CommercialInput };
    const seq = await repo.nextSequence();
    const id = formatProposalId(seq);
    const p = await repo.create(
      { id, ownerEmail: session.email, commercial: b.commercial ?? {} },
      { actorEmail: session.email, role, action: 'proposal.create', toState: 'rascunho_comercial' },
    );
    return json(201, { proposal: projectProposal(p, role) });
  }

  // --- rotas com :id ---
  const m = path.match(/^\/api\/proposals\/([A-Za-z0-9-]+)(\/(commercial|technical|audit))?$/);
  if (m) {
    const id = m[1]!;
    const sub = m[3];

    if (!sub && method === 'GET') {
      if (!can(role, 'proposal.read')) return json(403, { error: 'forbidden' });
      const p = await repo.get(id);
      if (!p) return json(404, { error: 'not_found' });
      return json(200, { proposal: projectProposal(p, role) });
    }

    if (sub === 'audit' && method === 'GET') {
      if (!can(role, 'proposal.read')) return json(403, { error: 'forbidden' });
      const entries = await repo.audit(id);
      return json(200, { audit: projectAudit(entries, role) });
    }

    if (sub === 'commercial' && method === 'PUT') {
      if (!can(role, 'proposal.edit_commercial')) return json(403, { error: 'forbidden' });
      const b = (body ?? {}) as { version?: unknown; commercial?: CommercialInput };
      const v = num(b.version);
      if (v === null) return json(400, { error: 'version_required' });
      try {
        const p = await repo.update(
          id,
          v,
          { commercial: b.commercial ?? {} },
          { actorEmail: session.email, role, action: 'proposal.edit_commercial' },
        );
        return json(200, { proposal: projectProposal(p, role) });
      } catch (e) {
        return mapRepoError(e);
      }
    }

    if (sub === 'technical' && method === 'PUT') {
      if (!can(role, 'proposal.edit_technical')) return json(403, { error: 'forbidden' });
      const b = (body ?? {}) as { version?: unknown; technical?: TechnicalInput };
      const v = num(b.version);
      if (v === null) return json(400, { error: 'version_required' });
      try {
        const p = await repo.update(
          id,
          v,
          { technical: b.technical ?? {} },
          { actorEmail: session.email, role, action: 'proposal.edit_technical' },
        );
        return json(200, { proposal: projectProposal(p, role) });
      } catch (e) {
        return mapRepoError(e);
      }
    }
  }

  return json(404, { error: 'not_found' });
}

function mapRepoError(e: unknown): ApiResult {
  if (e instanceof VersionConflictError) return json(409, { error: 'version_conflict', actual: e.actual });
  if (e instanceof NotFoundError) return json(404, { error: 'not_found' });
  throw e;
}

/** Papéis que o 2º fator pode conceder, para a tela de desbloqueio. */
export const UNLOCKABLE_ROLES: readonly Role[] = ['business', 'tech', 'admin'];
