import { describe, it, expect } from 'vitest';
import {
  isBusinessDay,
  businessDaysBetween,
  addBusinessDays,
  buildHolidaySet,
  reduceSla,
  defaultSlaConfig,
  type SlaEvent,
  type SlaConfig,
} from '../src/index.js';

/**
 * Testes do SLA técnico (prompt §6.7) — Passo 1: motor de dias úteis + relógio de pausas/retomadas.
 * Convenção congelada: dias úteis corridos, fuso America/Sao_Paulo, feriados nacionais BR.
 *
 * Âncoras de datas (SP = UTC-3, sem horário de verão): usamos T12:00:00-03:00 == T15:00:00Z.
 */
const at = (spDateTime: string): number => Date.parse(spDateTime);

// Feriados nacionais BR (inclui 2027). Semana de referência: 2027-03 não tem feriado nacional
// exceto Sexta-feira Santa em 26/03/2027.
const HOLIDAYS = buildHolidaySet();
const CFG: SlaConfig = defaultSlaConfig(HOLIDAYS);

describe('businessDays — motor de dias úteis (SP, feriados BR)', () => {
  it('reconhece fim de semana como não-útil e dia comum como útil', () => {
    // 2027-03-15 é segunda-feira; 2027-03-13 sábado; 2027-03-14 domingo.
    expect(isBusinessDay(at('2027-03-15T12:00:00-03:00'), HOLIDAYS)).toBe(true);
    expect(isBusinessDay(at('2027-03-13T12:00:00-03:00'), HOLIDAYS)).toBe(false);
    expect(isBusinessDay(at('2027-03-14T12:00:00-03:00'), HOLIDAYS)).toBe(false);
  });

  it('reconhece feriado nacional como não-útil (Sexta-feira Santa 2027-03-26)', () => {
    expect(isBusinessDay(at('2027-03-26T12:00:00-03:00'), HOLIDAYS)).toBe(false);
    // 2027-03-25 (quinta) é útil
    expect(isBusinessDay(at('2027-03-25T12:00:00-03:00'), HOLIDAYS)).toBe(true);
  });

  it('a data civil é a de São Paulo mesmo para instantes perto da meia-noite UTC', () => {
    // 2027-03-16T02:00:00Z == 2027-03-15T23:00 SP (ainda segunda, útil).
    expect(isBusinessDay(Date.parse('2027-03-16T02:00:00Z'), HOLIDAYS)).toBe(true);
  });

  it('§6.7.3 — contagem atravessa fim de semana corretamente', () => {
    // Sexta 2027-03-19 meio-dia -> +1 dia útil = segunda 2027-03-22 (pula sáb/dom).
    const start = at('2027-03-19T12:00:00-03:00');
    const due = addBusinessDays(start, 1, HOLIDAYS);
    // o vencimento cai na data civil de segunda-feira 2027-03-22
    expect(isBusinessDay(due, HOLIDAYS)).toBe(true);
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(due))).toBe('2027-03-22');
  });

  it('§6.7.3 — contagem atravessa feriado configurado', () => {
    // Quinta 2027-03-25 +1 dia útil: 26/03 é feriado (Sexta Santa), 27-28 fim de semana -> 29/03 (seg).
    const due = addBusinessDays(at('2027-03-25T12:00:00-03:00'), 1, HOLIDAYS);
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(due))).toBe('2027-03-29');
  });

  it('businessDaysBetween conta só dias úteis no intervalo', () => {
    // Seg 2027-03-15 -> Seg 2027-03-22: úteis = ter,qua,qui,sex,seg = 5 (exclui o próprio start, inclui o fim).
    const n = businessDaysBetween(at('2027-03-15T12:00:00-03:00'), at('2027-03-22T12:00:00-03:00'), HOLIDAYS);
    expect(n).toBe(5);
  });
});

describe('reduceSla — relógio auditável (§6.2 / §6.4)', () => {
  const started = (ts: string): SlaEvent => ({ kind: 'started', at: at(ts), by: 'tech@bondly', briefingVersion: 1 });

  it('§6.7.2 — started na entrada da fila inicia o relógio; status no_prazo', () => {
    const ev = [started('2027-03-15T09:00:00-03:00')];
    const s = reduceSla(ev, at('2027-03-15T10:00:00-03:00'), CFG);
    expect(s.phase).toBe('em_andamento');
    expect(s.health).toBe('no_prazo');
    expect(s.businessDaysRemaining).toBe(5);
    expect(s.startedAt).not.toBeNull();
    expect(s.dueAt).not.toBeNull();
  });

  it('sem evento started, o relógio não corre (§6.7.1 — nada antes do handoff completo)', () => {
    const s = reduceSla([], at('2027-03-15T10:00:00-03:00'), CFG);
    expect(s.phase).toBe('nao_iniciado');
    expect(s.businessDaysRemaining).toBe(5);
  });

  it('§6.7.8 — conclusão DENTRO de 5 dias úteis marca metSla=true', () => {
    const ev: SlaEvent[] = [
      started('2027-03-15T09:00:00-03:00'),
      { kind: 'completed', at: at('2027-03-18T09:00:00-03:00'), by: 'tech@bondly', verdict: 'aprovado' },
    ];
    const s = reduceSla(ev, at('2027-03-18T10:00:00-03:00'), CFG);
    expect(s.phase).toBe('concluido');
    expect(s.metSla).toBe(true);
    expect(s.verdict).toBe('aprovado');
  });

  it('§6.7.8 — conclusão FORA de 5 dias úteis marca metSla=false', () => {
    const ev: SlaEvent[] = [
      started('2027-03-15T09:00:00-03:00'),
      // conclui 2 semanas depois sem pausas -> consumiu > 5 dias úteis
      { kind: 'completed', at: at('2027-03-29T09:00:00-03:00'), by: 'tech@bondly', verdict: 'ajustes_necessarios' },
    ];
    const s = reduceSla(ev, at('2027-03-29T10:00:00-03:00'), CFG);
    expect(s.phase).toBe('concluido');
    expect(s.metSla).toBe(false);
  });

  it('§6.7.4 e §6.7.7 — pausa não retroage e retomada preserva o saldo (não reinicia os 5 dias)', () => {
    const ev: SlaEvent[] = [
      started('2027-03-15T09:00:00-03:00'),
      // pausa após ~2 dias úteis consumidos (qua 17/03)
      { kind: 'paused', at: at('2027-03-17T09:00:00-03:00'), by: 'tech@bondly', reason: 'faltam specs de integração', missingItems: ['api_docs'] },
    ];
    const pausedState = reduceSla(ev, at('2027-03-25T10:00:00-03:00'), CFG); // "now" bem depois da pausa
    expect(pausedState.phase).toBe('pausado');
    // tempo consumido congelado na pausa (~2 dias úteis), NÃO cresce com o "now" distante
    expect(pausedState.businessDaysElapsed).toBe(2);
    expect(pausedState.businessDaysRemaining).toBe(3);

    // retomada 1 semana depois: saldo continua 3, não volta a 5
    const resumed: SlaEvent[] = [
      ...ev,
      { kind: 'resumed', at: at('2027-03-24T09:00:00-03:00'), by: 'tech@bondly', confirmedItems: ['api_docs'] },
    ];
    const afterResume = reduceSla(resumed, at('2027-03-24T10:00:00-03:00'), CFG);
    expect(afterResume.phase).toBe('em_andamento');
    expect(afterResume.businessDaysRemaining).toBe(3); // preservou o saldo
    expect(afterResume.businessDaysElapsed).toBe(2);
  });

  it('status atencao quando resta 1 dia útil, vencido quando zera', () => {
    const ev = [started('2027-03-15T09:00:00-03:00')];
    // "agora" = quinta 2027-03-18: consumiu ter,qua,qui = ~3 úteis -> restam 2 (no_prazo ainda)
    expect(reduceSla(ev, at('2027-03-18T12:00:00-03:00'), CFG).health).toBe('no_prazo');
    // sexta 2027-03-19: consumiu 4 -> resta 1 -> atencao
    expect(reduceSla(ev, at('2027-03-19T12:00:00-03:00'), CFG).health).toBe('atencao');
    // terça 2027-03-23 (pulou fim de semana): consumiu >=5 -> vencido
    expect(reduceSla(ev, at('2027-03-23T12:00:00-03:00'), CFG).health).toBe('vencido');
  });
});
