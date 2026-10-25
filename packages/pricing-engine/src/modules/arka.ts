/** Classificação ARKA H1/H2/H3 (R-050). Reproduz a lógica de evidência de `render()`. */
import type { ArkaParameters } from '../contracts/types.js';

export interface EvidenceStage {
  readonly rank: number; // 1..15
  readonly maturity: string;
  readonly pipeline: string;
  readonly description: string;
}

/** Estágios de evidência (EVID do HTML), por rank 1..15. */
export const EVIDENCE_STAGES: Readonly<Record<number, EvidenceStage>> = {
  1: { rank: 1, maturity: 'Prospecção', pipeline: 'Identificado', description: 'Oportunidade sem evidência comercial formal.' },
  2: { rank: 2, maturity: 'Prospecção', pipeline: 'Identificado', description: 'Demanda ou oportunidade comercial identificada.' },
  3: { rank: 3, maturity: 'Prospecção', pipeline: 'Identificado', description: 'Primeiro contato comercial realizado.' },
  4: { rank: 4, maturity: 'Prospecção', pipeline: 'Identificado', description: 'Reunião inicial de apresentação ou descoberta concluída.' },
  5: { rank: 5, maturity: 'Qualificação', pipeline: 'Qualificado', description: 'Necessidade, potencial e aderência avaliados.' },
  6: { rank: 6, maturity: 'Cotação e proposta', pipeline: 'Qualificado', description: 'Cliente solicitou formalmente uma cotação.' },
  7: { rank: 7, maturity: 'Cotação e proposta', pipeline: 'Qualificado', description: 'Cotação comercial encaminhada ao cliente.' },
  8: { rank: 8, maturity: 'Cotação e proposta', pipeline: 'Proposta', description: 'Proposta comercial formal apresentada.' },
  9: { rank: 9, maturity: 'Negociação', pipeline: 'Negociação', description: 'Discussões sobre preços, escopo ou condições.' },
  10: { rank: 10, maturity: 'Piloto', pipeline: 'Negociação', description: 'Estruturação de piloto ou POC em discussão.' },
  11: { rank: 11, maturity: 'Piloto', pipeline: 'Negociação', description: 'Piloto ou POC formalmente iniciado.' },
  12: { rank: 12, maturity: 'Piloto', pipeline: 'Commit', description: 'Piloto finalizado, aguardando decisão.' },
  13: { rank: 13, maturity: 'Contratação', pipeline: 'Commit', description: 'Proposta em aprovação interna do cliente.' },
  14: { rank: 14, maturity: 'Contratação', pipeline: 'Commit', description: 'Condições alinhadas; contrato em elaboração ou assinatura.' },
  15: { rank: 15, maturity: 'Contratação', pipeline: 'Contratado', description: 'Contratação formalizada.' },
};

/** Elegibilidade documental H2: estágio ≥ 8 (proposta enviada, piloto ou contrato). */
export const EVIDENCE_MIN_H2 = 8;

export type ArkaClass = 'H1' | 'H2' | 'H3';

export interface ArkaResult {
  readonly stage: EvidenceStage;
  readonly checks: readonly { readonly label: string; readonly ok: boolean }[];
  readonly allOk: boolean;
  readonly arkaClass: ArkaClass;
  readonly classLabel: string;
  readonly note: string;
}

/** Classifica a oportunidade (R-050). */
export function arkaClassification(arka: ArkaParameters | undefined): ArkaResult {
  const a = arka ?? { clientName: '', goLiveDate: '', owner: '', evidenceStage: 1, probability: 0 };
  const stage = EVIDENCE_STAGES[a.evidenceStage] ?? EVIDENCE_STAGES[1]!;
  const checks = [
    { label: 'Cliente nomeado', ok: !!a.clientName.trim() },
    { label: 'Data de go-live', ok: !!a.goLiveDate },
    { label: 'Owner comercial', ok: !!a.owner.trim() },
    {
      label: 'Evidência comercial: proposta enviada, piloto ou contrato (estágio ≥ 8 de 15)',
      ok: stage.rank >= EVIDENCE_MIN_H2,
    },
    { label: 'Probabilidade declarada', ok: a.probability > 0 },
    { label: 'Volumetria, pricing, COGS e DSO preenchidos (este simulador)', ok: true },
  ];
  const allOk = checks.every((c) => c.ok);

  if (stage.rank === 15 && allOk) {
    return {
      stage,
      checks,
      allOk,
      arkaClass: 'H2',
      classLabel: 'H2 — Alta Visibilidade (contrato assinado)',
      note: 'Vira H1 quando o contrato estiver vigente e faturando. Registre no Pipeline com DSO e data de go-live.',
    };
  }
  if (allOk) {
    return {
      stage,
      checks,
      allOk,
      arkaClass: 'H2',
      classLabel: 'H2 — Alta Visibilidade',
      note: 'Elegível ao Orçamento Compromissado. Classificação final é de Comercial + Financeiro + CEO após registro no Pipeline/Master.',
    };
  }
  return {
    stage,
    checks,
    allOk,
    arkaClass: 'H3',
    classLabel: 'H3 — Modular (fora da Base)',
    note: 'Economics bons não bastam: sem os itens pendentes a oportunidade fica fora do Budget 2027. Complete a evidência antes de prometer receita.',
  };
}
