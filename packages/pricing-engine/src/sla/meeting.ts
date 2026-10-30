/**
 * Máquina de estados da REUNIÃO TÉCNICA com o cliente (prompt §6.3) — PURA e testável.
 *
 * A reunião é uma etapa CONDICIONAL dentro da avaliação técnica (não universal, não agendada
 * automaticamente). Negócios coordena o contato com o cliente; P&T define os requisitos técnicos.
 *
 * REGRA CRÍTICA (§6.4): solicitar/agendar uma reunião NÃO pausa o SLA automaticamente. A pausa do
 * relógio é uma ação separada e explícita (sla/clock via endpoint), só quando a reunião/resposta
 * for de fato indispensável para avançar. Esta máquina modela APENAS o ciclo da reunião.
 *
 * Fluxo (§6.3):
 *   solicitada → em_agendamento → agendada → realizada → aguardando_insumos → insumos_recebidos
 *              → avaliacao_retomada
 * Com cancelamento justificado possível a partir de qualquer estado não-terminal.
 */

/** Os 7 estados do §6.3 + o estado terminal de cancelamento. */
export type MeetingState =
  | 'solicitada'
  | 'em_agendamento'
  | 'agendada'
  | 'realizada'
  | 'aguardando_insumos'
  | 'insumos_recebidos'
  | 'avaliacao_retomada'
  | 'cancelada';

export type MeetingTransition =
  | 'iniciar_agendamento' // solicitada → em_agendamento
  | 'agendar' // em_agendamento → agendada
  | 'realizar' // agendada → realizada
  | 'aguardar_insumos' // realizada → aguardando_insumos
  | 'receber_insumos' // aguardando_insumos → insumos_recebidos
  | 'retomar_avaliacao' // insumos_recebidos | realizada → avaliacao_retomada
  | 'cancelar'; // qualquer não-terminal → cancelada (justificado)

interface MeetingTransitionDef {
  readonly from: readonly MeetingState[];
  readonly to: MeetingState;
}

/** Estados terminais (sem saída). */
const TERMINAL: readonly MeetingState[] = ['avaliacao_retomada', 'cancelada'];

const MEETING_TRANSITIONS: Readonly<Record<MeetingTransition, MeetingTransitionDef>> = {
  iniciar_agendamento: { from: ['solicitada'], to: 'em_agendamento' },
  agendar: { from: ['em_agendamento'], to: 'agendada' },
  realizar: { from: ['agendada'], to: 'realizada' },
  aguardar_insumos: { from: ['realizada'], to: 'aguardando_insumos' },
  receber_insumos: { from: ['aguardando_insumos'], to: 'insumos_recebidos' },
  // §6.3: após a reunião realizada (sem pendência) ou após receber insumos, a avaliação é retomada.
  retomar_avaliacao: { from: ['realizada', 'insumos_recebidos'], to: 'avaliacao_retomada' },
  // cancelamento justificado a partir de qualquer estado não-terminal.
  cancelar: { from: ['solicitada', 'em_agendamento', 'agendada', 'realizada', 'aguardando_insumos', 'insumos_recebidos'], to: 'cancelada' },
};

export function isMeetingTransition(v: unknown): v is MeetingTransition {
  return typeof v === 'string' && v in MEETING_TRANSITIONS;
}

export function isMeetingTerminal(s: MeetingState): boolean {
  return TERMINAL.includes(s);
}

export type MeetingDecision =
  | { readonly ok: true; readonly to: MeetingState }
  | { readonly ok: false; readonly reason: 'unknown_transition' | 'invalid_from' };

/**
 * Decide uma transição da reunião a partir do estado atual. PURA. Deny-by-default.
 * O estado inicial ao SOLICITAR uma reunião é 'solicitada' (criada pelo endpoint, não por transição).
 */
export function canMeetingTransition(current: MeetingState, name: string): MeetingDecision {
  if (!isMeetingTransition(name)) return { ok: false, reason: 'unknown_transition' };
  const def = MEETING_TRANSITIONS[name];
  if (!def.from.includes(current)) return { ok: false, reason: 'invalid_from' };
  return { ok: true, to: def.to };
}

/** Estado inicial de uma reunião recém-solicitada (§6.3). */
export const MEETING_INITIAL: MeetingState = 'solicitada';
