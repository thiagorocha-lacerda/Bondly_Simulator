/**
 * Calendário de feriados para o SLA (prompt §6.2 — "não presuma feriados locais sem fonte/
 * configuração; documente o calendário efetivamente utilizado").
 *
 * FONTE: feriados NACIONAIS brasileiros (Lei nº 662/1949, Lei nº 6.802/1980 — Nossa Senhora
 * Aparecida, e os móveis derivados da Páscoa). NÃO inclui feriados estaduais/municipais nem
 * pontos facultativos (ex.: Carnaval e Corpus Christi são facultativos em âmbito federal) —
 * acrescente-os via `extraHolidays` na configuração do SLA se o calendário corporativo os adotar.
 *
 * Esta lista é CONFIGURÁVEL: o motor de SLA recebe um Set de datas, então o operador pode
 * sobrepor/estender. Os anos abaixo cobrem o horizonte de uso (2026-2028); estender conforme
 * necessário. Datas em 'YYYY-MM-DD' na data civil de São Paulo.
 */

import type { SpDate } from './businessDays.js';

/** Feriados nacionais fixos + móveis (Páscoa) para os anos cobertos. Fonte: legislação federal BR. */
export const BR_NATIONAL_HOLIDAYS: readonly SpDate[] = [
  // 2026
  '2026-01-01', // Confraternização Universal
  '2026-04-03', // Sexta-feira Santa (móvel)
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-09-07', // Independência
  '2026-10-12', // Nossa Senhora Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-12-25', // Natal
  // 2027
  '2027-01-01',
  '2027-03-26', // Sexta-feira Santa (móvel)
  '2027-04-21',
  '2027-05-01',
  '2027-09-07',
  '2027-10-12',
  '2027-11-02',
  '2027-11-15',
  '2027-12-25',
  // 2028
  '2028-01-01',
  '2028-04-14', // Sexta-feira Santa (móvel)
  '2028-04-21',
  '2028-05-01',
  '2028-09-07',
  '2028-10-12',
  '2028-11-02',
  '2028-11-15',
  '2028-12-25',
];

/**
 * Monta o Set de feriados efetivo combinando a base nacional com extras do calendário corporativo.
 * @param extraHolidays datas 'YYYY-MM-DD' adicionais (ex.: Carnaval, feriado municipal).
 * @param base lista base (default: feriados nacionais). Passe [] para ignorar a base.
 */
export function buildHolidaySet(
  extraHolidays: readonly SpDate[] = [],
  base: readonly SpDate[] = BR_NATIONAL_HOLIDAYS,
): ReadonlySet<SpDate> {
  return new Set<SpDate>([...base, ...extraHolidays]);
}
