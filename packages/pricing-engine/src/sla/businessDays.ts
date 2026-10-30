/**
 * Motor de DIAS ÚTEIS para o SLA técnico (prompt §6.2).
 *
 * CONVENÇÃO ADOTADA (documentada e única, conforme §6.2 exige):
 *   - Contagem por DIAS ÚTEIS CORRIDOS (não horas de expediente). "5 dias úteis" significa os
 *     5 próximos dias que não sejam sábado, domingo ou feriado configurado.
 *   - Fuso: America/Sao_Paulo. Toda a aritmética de calendário é feita sobre a DATA LOCAL
 *     (YYYY-MM-DD) em São Paulo, derivada do instante UTC — assim o resultado independe do fuso
 *     do servidor (Render roda em UTC).
 *   - Feriados: lista configurável de datas 'YYYY-MM-DD' (ver sla/holidays.ts). §6.2 proíbe
 *     presumir feriados sem fonte; por isso a lista é um parâmetro explícito, não embutida aqui.
 *
 * Esta unidade é PURA (sem relógio, sem I/O): recebe instantes e o calendário, devolve números e
 * datas. O estado do SLA (pausas, retomadas) vive em sla/clock.ts sobre este motor.
 */

/** Um instante absoluto em epoch-millis (UTC). */
export type Instant = number;

/** Data civil em São Paulo, no formato 'YYYY-MM-DD'. */
export type SpDate = string;

const SP_TZ = 'America/Sao_Paulo';

// Formatter reutilizável: extrai os componentes de data no fuso de São Paulo de um instante UTC.
const spParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

interface SpCivil {
  readonly date: SpDate; // 'YYYY-MM-DD'
  readonly weekday: string; // 'Mon'..'Sun'
}

/** Projeta um instante UTC para a data civil em São Paulo. */
export function toSpCivil(instant: Instant): SpCivil {
  const parts = spParts.formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return { date, weekday: get('weekday') };
}

/** true se a data civil SP for sábado ou domingo. */
function isWeekend(weekday: string): boolean {
  return weekday === 'Sat' || weekday === 'Sun';
}

/**
 * true se a data civil (em SP) for dia útil: não é fim de semana e não está na lista de feriados.
 * `holidays` é um Set de strings 'YYYY-MM-DD'.
 */
export function isBusinessDay(instant: Instant, holidays: ReadonlySet<SpDate>): boolean {
  const { date, weekday } = toSpCivil(instant);
  return !isWeekend(weekday) && !holidays.has(date);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Avança `instant` para o PRÓXIMO início de dia útil (ou o mesmo dia, se já for dia útil).
 * Opera somando dias civis; como a contagem é por dias corridos, a hora exata dentro do dia não
 * altera o número de dias úteis — normalizamos para o meio-dia SP de cada data para evitar
 * ambiguidade de borda (DST em SP foi extinto, mas o meio-dia é seguro de qualquer forma).
 */
function spNoonInstant(date: SpDate): Instant {
  // Meio-dia local SP ~= 15:00 UTC (SP = UTC-3, sem horário de verão desde 2019). Usamos 15:00Z
  // como âncora estável; isBusinessDay reprojeta para a data civil de qualquer modo.
  return Date.parse(`${date}T15:00:00.000Z`);
}

/**
 * Conta quantos DIAS ÚTEIS existem no intervalo (from, to] — útil para "tempo decorrido".
 * Ambos instantes; conta cada data civil SP estritamente após a de `from` até a de `to`.
 */
export function businessDaysBetween(from: Instant, to: Instant, holidays: ReadonlySet<SpDate>): number {
  if (to <= from) return 0;
  const fromDate = toSpCivil(from).date;
  const toDate = toSpCivil(to).date;
  let count = 0;
  let cursorDate = fromDate;
  // Caminha dia a dia pela data civil até alcançar a data de `to`.
  let guard = 0;
  while (cursorDate < toDate && guard < 100000) {
    // próximo dia civil
    const next = toSpCivil(spNoonInstant(cursorDate) + DAY_MS).date;
    cursorDate = next;
    if (isBusinessDay(spNoonInstant(cursorDate), holidays)) count += 1;
    guard += 1;
  }
  return count;
}

/**
 * Dado um instante inicial e um número de DIAS ÚTEIS de prazo, devolve o instante de VENCIMENTO
 * (fim do N-ésimo dia útil, representado como o início — 00:00 SP — do dia seguinte ao último
 * dia útil contado; na prática usamos o meio-dia âncora do N-ésimo dia útil para comparações).
 *
 * Regra: se `start` cai num dia útil, esse dia conta como o "dia 0" de entrada na fila; o prazo
 * são os próximos N dias úteis. due = âncora do N-ésimo dia útil estritamente após a data de start
 * (contagem padrão de SLA: "5 dias úteis a partir de amanhã útil" seria N+1; aqui adotamos
 * "5 dias úteis contados inclusivamente a partir do próximo dia útil"). Ver testes para a semântica
 * exata congelada.
 */
export function addBusinessDays(start: Instant, businessDays: number, holidays: ReadonlySet<SpDate>): Instant {
  if (businessDays <= 0) return start;
  let remaining = businessDays;
  let cursorDate = toSpCivil(start).date;
  let guard = 0;
  while (remaining > 0 && guard < 100000) {
    const next = toSpCivil(spNoonInstant(cursorDate) + DAY_MS).date;
    cursorDate = next;
    if (isBusinessDay(spNoonInstant(cursorDate), holidays)) remaining -= 1;
    guard += 1;
  }
  return spNoonInstant(cursorDate);
}
