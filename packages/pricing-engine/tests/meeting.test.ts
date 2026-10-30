import { describe, it, expect } from 'vitest';
import {
  canMeetingTransition,
  isMeetingTerminal,
  MEETING_INITIAL,
  type MeetingState,
} from '../src/index.js';

/** Testes da máquina de reunião técnica (§6.3) — pura, deny-by-default. */
describe('meeting — máquina de estados da reunião técnica (§6.3)', () => {
  it('estado inicial é solicitada', () => {
    expect(MEETING_INITIAL).toBe('solicitada');
  });

  it('percorre o fluxo feliz completo até avaliacao_retomada', () => {
    const path: Array<[MeetingState, string, MeetingState]> = [
      ['solicitada', 'iniciar_agendamento', 'em_agendamento'],
      ['em_agendamento', 'agendar', 'agendada'],
      ['agendada', 'realizar', 'realizada'],
      ['realizada', 'aguardar_insumos', 'aguardando_insumos'],
      ['aguardando_insumos', 'receber_insumos', 'insumos_recebidos'],
      ['insumos_recebidos', 'retomar_avaliacao', 'avaliacao_retomada'],
    ];
    for (const [from, t, to] of path) {
      const d = canMeetingTransition(from, t);
      expect(d.ok).toBe(true);
      if (d.ok) expect(d.to).toBe(to);
    }
  });

  it('permite retomar a avaliação direto de realizada (sem pendência de insumos)', () => {
    const d = canMeetingTransition('realizada', 'retomar_avaliacao');
    expect(d.ok && d.to).toBe('avaliacao_retomada');
  });

  it('permite cancelar a partir de qualquer estado não-terminal', () => {
    for (const s of ['solicitada', 'em_agendamento', 'agendada', 'realizada', 'aguardando_insumos', 'insumos_recebidos'] as MeetingState[]) {
      const d = canMeetingTransition(s, 'cancelar');
      expect(d.ok && d.to).toBe('cancelada');
    }
  });

  it('estados terminais não têm saída (deny-by-default)', () => {
    expect(isMeetingTerminal('avaliacao_retomada')).toBe(true);
    expect(isMeetingTerminal('cancelada')).toBe(true);
    expect(canMeetingTransition('cancelada', 'iniciar_agendamento').ok).toBe(false);
    expect(canMeetingTransition('avaliacao_retomada', 'cancelar').ok).toBe(false);
  });

  it('transição inválida a partir do estado errado é recusada (invalid_from)', () => {
    const d = canMeetingTransition('solicitada', 'realizar'); // pula etapas
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('invalid_from');
  });

  it('transição desconhecida é recusada (unknown_transition)', () => {
    const d = canMeetingTransition('solicitada', 'teleportar');
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('unknown_transition');
  });
});
