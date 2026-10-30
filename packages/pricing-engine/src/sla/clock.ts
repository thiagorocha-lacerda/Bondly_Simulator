/**
 * Relógio do SLA técnico (prompt §6.2 e §6.4) — redução PURA de uma lista de eventos para o estado
 * do relógio. Sem I/O, sem Date.now() interno: o "agora" é sempre passado como argumento, para o
 * cálculo ser determinístico e testável.
 *
 * SEMÂNTICA CONGELADA (§6.4):
 *   - O relógio inicia quando o briefing está completo e entra na fila técnica (evento 'started').
 *   - Uma PAUSA ('paused') só vale a partir do seu timestamp; NÃO retroage e NÃO apaga tempo já
 *     consumido. Enquanto pausado, o tempo não corre.
 *   - A RETOMADA ('resumed') continua com o SALDO restante; NUNCA reinicia os 5 dias.
 *   - A CONCLUSÃO ('completed') congela o relógio no parecer técnico.
 *   - "Tempo efetivo" = dias úteis decorridos APENAS nos intervalos ativos (fora de pausa).
 */

import { addBusinessDays, businessDaysBetween, type Instant, type SpDate } from './businessDays.js';

/** Eventos auditáveis do relógio. Ordem cronológica por `at`. */
export type SlaEvent =
  | { readonly kind: 'started'; readonly at: Instant; readonly by: string; readonly briefingVersion: number }
  | { readonly kind: 'paused'; readonly at: Instant; readonly by: string; readonly reason: string; readonly missingItems: readonly string[] }
  | { readonly kind: 'resumed'; readonly at: Instant; readonly by: string; readonly confirmedItems: readonly string[] }
  | { readonly kind: 'completed'; readonly at: Instant; readonly by: string; readonly verdict: TechnicalVerdict };

export type TechnicalVerdict = 'aprovado' | 'aprovado_com_ressalvas' | 'ajustes_necessarios' | 'inviavel';

export type SlaPhase = 'nao_iniciado' | 'em_andamento' | 'pausado' | 'concluido';

export type SlaHealth = 'no_prazo' | 'atencao' | 'vencido' | 'pausado' | 'concluido' | 'nao_iniciado';

export interface SlaConfig {
  /** Prazo em dias úteis (default 5 — §6.2, configurável só por admin com trilha de auditoria). */
  readonly businessDays: number;
  /** Feriados efetivos (ver sla/holidays.ts). */
  readonly holidays: ReadonlySet<SpDate>;
  /** Dias úteis restantes a partir dos quais o status vira 'atencao' (default 1 — §6.2). */
  readonly attentionThresholdDays: number;
}

export interface SlaState {
  readonly phase: SlaPhase;
  readonly health: SlaHealth;
  readonly startedAt: Instant | null;
  /** Vencimento projetado considerando as pausas já ocorridas (recomputado a cada pausa/retomada). */
  readonly dueAt: Instant | null;
  /** Dias úteis de tempo EFETIVO já consumidos (exclui pausas). */
  readonly businessDaysElapsed: number;
  /** Dias úteis de tempo EFETIVO restantes até o vencimento. */
  readonly businessDaysRemaining: number;
  readonly pausedAt: Instant | null;
  readonly pauseReason: string | null;
  readonly completedAt: Instant | null;
  readonly verdict: TechnicalVerdict | null;
  /** Concluído dentro do SLA? (null enquanto não concluído) */
  readonly metSla: boolean | null;
}

/**
 * Reduz os eventos (em ordem cronológica) + o instante `now` ao estado atual do relógio.
 * `now` é usado para projetar consumido/restante quando o relógio está ativo.
 */
export function reduceSla(events: readonly SlaEvent[], now: Instant, config: SlaConfig): SlaState {
  const base: SlaState = {
    phase: 'nao_iniciado',
    health: 'nao_iniciado',
    startedAt: null,
    dueAt: null,
    businessDaysElapsed: 0,
    businessDaysRemaining: config.businessDays,
    pausedAt: null,
    pauseReason: null,
    completedAt: null,
    verdict: null,
    metSla: null,
  };

  let startedAt: Instant | null = null;
  let pausedAt: Instant | null = null;
  let pauseReason: string | null = null;
  let completedAt: Instant | null = null;
  let verdict: TechnicalVerdict | null = null;
  // Soma de dias úteis consumidos em segmentos ATIVOS já fechados (entre started/resumed e paused).
  let consumedClosed = 0;
  // Início do segmento ativo atual (null se pausado ou não iniciado).
  let activeSince: Instant | null = null;

  for (const ev of events) {
    switch (ev.kind) {
      case 'started':
        startedAt = ev.at;
        activeSince = ev.at;
        break;
      case 'paused':
        if (activeSince !== null) {
          consumedClosed += businessDaysBetween(activeSince, ev.at, config.holidays);
          activeSince = null;
        }
        pausedAt = ev.at;
        pauseReason = ev.reason;
        break;
      case 'resumed':
        activeSince = ev.at;
        pausedAt = null;
        pauseReason = null;
        break;
      case 'completed':
        if (activeSince !== null) {
          consumedClosed += businessDaysBetween(activeSince, ev.at, config.holidays);
          activeSince = null;
        }
        completedAt = ev.at;
        verdict = ev.verdict;
        break;
    }
  }

  if (startedAt === null) return base;

  // Tempo efetivo consumido: segmentos fechados + segmento ativo em aberto (até `now`).
  const openConsumed = activeSince !== null ? businessDaysBetween(activeSince, now, config.holidays) : 0;
  const elapsed = consumedClosed + openConsumed;
  const remaining = Math.max(0, config.businessDays - elapsed);

  // Vencimento projetado: a partir do início do segmento ativo atual (ou da pausa), soma o SALDO
  // restante em dias úteis. Se concluído, o "due" histórico perde relevância operacional.
  let dueAt: Instant | null;
  if (activeSince !== null) {
    dueAt = addBusinessDays(activeSince, remaining, config.holidays);
  } else if (pausedAt !== null) {
    // Pausado: due fica suspenso; projetamos a partir da pausa para exibição ("se retomar agora").
    dueAt = addBusinessDays(pausedAt, remaining, config.holidays);
  } else {
    dueAt = addBusinessDays(startedAt, config.businessDays, config.holidays);
  }

  let phase: SlaPhase;
  let health: SlaHealth;
  let metSla: boolean | null = null;

  if (completedAt !== null) {
    phase = 'concluido';
    health = 'concluido';
    metSla = elapsed <= config.businessDays;
  } else if (pausedAt !== null) {
    phase = 'pausado';
    health = 'pausado';
  } else {
    phase = 'em_andamento';
    if (remaining <= 0) health = 'vencido';
    else if (remaining <= config.attentionThresholdDays) health = 'atencao';
    else health = 'no_prazo';
  }

  return {
    phase,
    health,
    startedAt,
    dueAt,
    businessDaysElapsed: elapsed,
    businessDaysRemaining: remaining,
    pausedAt,
    pauseReason,
    completedAt,
    verdict,
    metSla,
  };
}

/** Config padrão: 5 dias úteis, feriados nacionais BR, atenção a 1 dia útil restante (§6.2). */
export function defaultSlaConfig(holidays: ReadonlySet<SpDate>): SlaConfig {
  return { businessDays: 5, holidays, attentionThresholdDays: 1 };
}
