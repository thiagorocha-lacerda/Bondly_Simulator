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
  type SlaEventRow,
  VersionConflictError,
  NotFoundError,
  formatProposalId,
} from './domain.js';
import { projectProposal, projectAudit } from './projection.js';
import { canTransition, invalidationOnEdit, isMaterialChange } from './workflow.js';
import {
  reduceSla,
  defaultSlaConfig,
  buildHolidaySet,
  canMeetingTransition,
  MEETING_INITIAL,
  type SlaEvent,
  type TechnicalVerdict,
} from '@bondly/pricing-engine';

/** Calendário de feriados efetivo do SLA (base nacional BR; extras viriam da config). */
const SLA_HOLIDAYS = buildHolidaySet();
const SLA_CONFIG = defaultSlaConfig(SLA_HOLIDAYS);

/** Reconstrói os eventos tipados do engine a partir das rows persistidas (ordenadas por `at`). */
function toEngineEvents(rows: readonly SlaEventRow[]): SlaEvent[] {
  return [...rows]
    .sort((a, b) => a.at - b.at)
    .map((r): SlaEvent => {
      const p = r.payload;
      switch (r.kind) {
        case 'started':
          return { kind: 'started', at: r.at, by: r.by, briefingVersion: Number(p.briefingVersion ?? 1) };
        case 'paused':
          return {
            kind: 'paused',
            at: r.at,
            by: r.by,
            reason: String(p.reason ?? ''),
            missingItems: Array.isArray(p.missingItems) ? (p.missingItems as string[]) : [],
          };
        case 'resumed':
          return {
            kind: 'resumed',
            at: r.at,
            by: r.by,
            confirmedItems: Array.isArray(p.confirmedItems) ? (p.confirmedItems as string[]) : [],
          };
        case 'completed': {
          const verdicts: readonly TechnicalVerdict[] = ['aprovado', 'aprovado_com_ressalvas', 'ajustes_necessarios', 'inviavel'];
          const v = verdicts.includes(p.verdict as TechnicalVerdict) ? (p.verdict as TechnicalVerdict) : 'aprovado';
          return { kind: 'completed', at: r.at, by: r.by, verdict: v };
        }
      }
    });
}

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

  // --- reunião técnica com o cliente (§6.3) ---
  // listar reuniões de uma proposta
  const mList = path.match(/^\/api\/proposals\/([A-Za-z0-9-]+)\/meetings$/);
  if (mList && method === 'GET') {
    if (!can(role, 'proposal.read')) return json(403, { error: 'forbidden' });
    const id = mList[1]!;
    const list = await repo.meetings(id);
    return json(200, { meetings: list });
  }
  // solicitar uma reunião (estado inicial 'solicitada') — só quem gere o SLA técnico
  if (mList && method === 'POST') {
    if (!can(role, 'sla.manage')) return json(403, { error: 'forbidden' });
    const id = mList[1]!;
    const current = await repo.get(id);
    if (!current) return json(404, { error: 'not_found' });
    const b = (body ?? {}) as { objective?: unknown; scheduledFor?: unknown };
    const objective = typeof b.objective === 'string' ? b.objective.trim() : '';
    if (!objective) return json(400, { error: 'objective_required' });
    const scheduledFor = typeof b.scheduledFor === 'string' ? b.scheduledFor : undefined;
    const rec = await repo.createMeeting({ proposalId: id, objective, by: session.email, ...(scheduledFor ? { scheduledFor } : {}) });
    // §6.4: solicitar reunião NÃO pausa o SLA automaticamente — nenhum evento de pausa é emitido aqui.
    return json(201, { meeting: rec, slaUnaffected: true });
  }
  // transicionar uma reunião (agendar, realizar, aguardar/receber insumos, retomar, cancelar)
  const mTrans = path.match(/^\/api\/proposals\/([A-Za-z0-9-]+)\/meetings\/([A-Za-z0-9-]+)\/transition$/);
  if (mTrans && method === 'POST') {
    if (!can(role, 'sla.manage')) return json(403, { error: 'forbidden' });
    const meetingId = mTrans[2]!;
    const all = await repo.meetings(mTrans[1]!);
    const meeting = all.find((m) => m.id === meetingId);
    if (!meeting) return json(404, { error: 'not_found' });
    const b = (body ?? {}) as { transition?: unknown; note?: unknown; scheduledFor?: unknown };
    const name = typeof b.transition === 'string' ? b.transition : '';
    const decision = canMeetingTransition(meeting.state as Parameters<typeof canMeetingTransition>[0], name);
    if (!decision.ok) return json(409, { error: `meeting_${decision.reason}` });
    const note = typeof b.note === 'string' ? b.note : undefined;
    // cancelamento exige justificativa (§6.3)
    if (name === 'cancelar' && !note) return json(400, { error: 'note_required' });
    const scheduledFor = typeof b.scheduledFor === 'string' ? b.scheduledFor : undefined;
    const rec = await repo.updateMeeting(meetingId, {
      state: decision.to,
      logEntry: { at: Date.now(), by: session.email, transition: name, toState: decision.to, ...(note ? { note } : {}) },
      ...(scheduledFor !== undefined ? { scheduledFor } : {}),
    });
    return json(200, { meeting: rec });
  }

  // --- rotas com :id ---
  const m = path.match(/^\/api\/proposals\/([A-Za-z0-9-]+)(\/(commercial|technical|audit|transition|sla|sla\/pause|sla\/resume|sla\/complete))?$/);
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
      const current = await repo.get(id);
      if (!current) return json(404, { error: 'not_found' });
      const nextCommercial = b.commercial ?? {};
      // §5.2: mudança material pós-aprovação invalida a aprovação e retorna à etapa apropriada.
      const material = isMaterialChange('commercial', current.commercial, nextCommercial);
      const invalidateTo = material ? invalidationOnEdit(current.status, 'commercial') : null;
      try {
        const p = await repo.update(
          id,
          v,
          { commercial: nextCommercial, ...(invalidateTo ? { status: invalidateTo } : {}) },
          {
            actorEmail: session.email,
            role,
            action: 'proposal.edit_commercial',
            ...(invalidateTo ? { fromState: current.status, toState: invalidateTo, note: 'aprovação invalidada por mudança material comercial' } : {}),
          },
        );
        return json(200, { proposal: projectProposal(p, role), invalidated: invalidateTo !== null });
      } catch (e) {
        return mapRepoError(e);
      }
    }

    if (sub === 'technical' && method === 'PUT') {
      if (!can(role, 'proposal.edit_technical')) return json(403, { error: 'forbidden' });
      const b = (body ?? {}) as { version?: unknown; technical?: TechnicalInput };
      const v = num(b.version);
      if (v === null) return json(400, { error: 'version_required' });
      const current = await repo.get(id);
      if (!current) return json(404, { error: 'not_found' });
      const nextTechnical = b.technical ?? {};
      const material = isMaterialChange(
        'technical',
        current.technical as Record<string, unknown> | undefined,
        nextTechnical as Record<string, unknown>,
      );
      const invalidateTo = material ? invalidationOnEdit(current.status, 'technical') : null;
      try {
        const p = await repo.update(
          id,
          v,
          { technical: nextTechnical, ...(invalidateTo ? { status: invalidateTo } : {}) },
          {
            actorEmail: session.email,
            role,
            action: 'proposal.edit_technical',
            ...(invalidateTo ? { fromState: current.status, toState: invalidateTo, note: 'aprovação invalidada por mudança material técnica' } : {}),
          },
        );
        return json(200, { proposal: projectProposal(p, role), invalidated: invalidateTo !== null });
      } catch (e) {
        return mapRepoError(e);
      }
    }

    // --- SLA técnico (§6) ---
    if (sub === 'sla' && method === 'GET') {
      if (!can(role, 'proposal.read')) return json(403, { error: 'forbidden' });
      const current = await repo.get(id);
      if (!current) return json(404, { error: 'not_found' });
      const rows = await repo.slaEvents(id);
      const state = reduceSla(toEngineEvents(rows), Date.now(), SLA_CONFIG);
      return json(200, { sla: state });
    }

    // pausar / retomar / concluir o relógio — exige sla.manage (tech/admin)
    if ((sub === 'sla/pause' || sub === 'sla/resume' || sub === 'sla/complete') && method === 'POST') {
      if (!can(role, 'sla.manage')) return json(403, { error: 'forbidden' });
      const current = await repo.get(id);
      if (!current) return json(404, { error: 'not_found' });
      const rows = await repo.slaEvents(id);
      const prior = reduceSla(toEngineEvents(rows), Date.now(), SLA_CONFIG);
      const sb = (body ?? {}) as Record<string, unknown>;

      if (sub === 'sla/pause') {
        // §6.4: só pausa se o relógio está em andamento; justificativa obrigatória.
        if (prior.phase !== 'em_andamento') return json(409, { error: 'sla_not_running' });
        const reason = typeof sb.reason === 'string' ? sb.reason.trim() : '';
        if (!reason) return json(400, { error: 'reason_required' });
        const missingItems = Array.isArray(sb.missingItems) ? (sb.missingItems as unknown[]).map(String) : [];
        await repo.appendSlaEvent({ proposalId: id, kind: 'paused', at: Date.now(), by: session.email, payload: { reason, missingItems } });
      } else if (sub === 'sla/resume') {
        if (prior.phase !== 'pausado') return json(409, { error: 'sla_not_paused' });
        const confirmedItems = Array.isArray(sb.confirmedItems) ? (sb.confirmedItems as unknown[]).map(String) : [];
        await repo.appendSlaEvent({ proposalId: id, kind: 'resumed', at: Date.now(), by: session.email, payload: { confirmedItems } });
      } else {
        // sla/complete — emite o parecer técnico e congela o relógio.
        if (prior.phase === 'nao_iniciado' || prior.phase === 'concluido') return json(409, { error: 'sla_not_active' });
        const verdicts = ['aprovado', 'aprovado_com_ressalvas', 'ajustes_necessarios', 'inviavel'];
        const verdict = typeof sb.verdict === 'string' && verdicts.includes(sb.verdict) ? sb.verdict : '';
        if (!verdict) return json(400, { error: 'verdict_required' });
        await repo.appendSlaEvent({ proposalId: id, kind: 'completed', at: Date.now(), by: session.email, payload: { verdict } });
      }

      const rowsAfter = await repo.slaEvents(id);
      const state = reduceSla(toEngineEvents(rowsAfter), Date.now(), SLA_CONFIG);
      return json(200, { sla: state });
    }

    if (sub === 'transition' && method === 'POST') {
      const b = (body ?? {}) as { version?: unknown; transition?: unknown; note?: unknown };
      const v = num(b.version);
      if (v === null) return json(400, { error: 'version_required' });
      const current = await repo.get(id);
      if (!current) return json(404, { error: 'not_found' });
      const name = typeof b.transition === 'string' ? b.transition : '';
      const decision = canTransition(current.status, name, role);
      if (!decision.ok) {
        // emissão exige a ação proposal.emit além da transição (dupla checagem de alçada)
        return json(decision.reason === 'wrong_role' ? 403 : 409, { error: `transition_${decision.reason}` });
      }
      // a emissão também é gated pela ação RBAC proposal.emit (§6.1)
      if (decision.to === 'emitido' && !can(role, 'proposal.emit')) return json(403, { error: 'forbidden' });
      const note = typeof b.note === 'string' ? b.note : undefined;
      try {
        const p = await repo.update(
          id,
          v,
          { status: decision.to },
          { actorEmail: session.email, role, action: `transition.${name}`, fromState: current.status, toState: decision.to, ...(note ? { note } : {}) },
        );
        // §6.1 — marco inicial do SLA: ao submeter para análise, o relógio técnico inicia na entrada
        // da fila (briefing completo e encaminhado). Idempotente: só o primeiro 'started' vale.
        if (name === 'submeter_analise') {
          const existing = await repo.slaEvents(id);
          const hasStarted = existing.some((e) => e.kind === 'started');
          if (!hasStarted) {
            await repo.appendSlaEvent({
              proposalId: id,
              kind: 'started',
              at: Date.now(),
              by: session.email,
              payload: { briefingVersion: p.version },
            });
          }
        }
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
