/**
 * Governança de premissas comerciais (prompt §6, §6.1, §27.6 e requisito complementar de versionamento).
 *
 * Toda premissa financeira vive AQUI (fonte única) — nenhum valor fixo espalhado pelo motor.
 * Cada premissa carrega: nome, valor, unidade, fonte, data de referência e status de validação.
 * O conjunto de premissas é VERSIONADO; cada proposta armazena um SNAPSHOT IMUTÁVEL da versão
 * aplicada, de modo que uma proposta de out/2026 reproduz seus cálculos mesmo que os preços mudem
 * em jan/2027.
 */

export type PremiseStatus = 'validada' | 'pendente' | 'divergente';

export interface Premise<T = number> {
  readonly value: T;
  readonly unit: string;
  readonly source: string;
  readonly referenceDate: string; // ISO yyyy-mm-dd
  readonly status: PremiseStatus;
}

/** Faixa progressiva genérica: [limiteInferior, limiteSuperior, valorUnitário]. */
export type Band = readonly [from: number, to: number, unit: number];

export interface CommunicationTariffs {
  readonly rcs: number;
  readonly wa: number;
  readonly sms: number;
  readonly email: number;
}

export interface TierDefinition {
  readonly name: string;
  readonly users: number;
  readonly platformFee: number;
  readonly setup: number;
}

export interface ComplexityBand {
  readonly name: string;
  readonly maxScore: number; // exclusivo (score < maxScore)
  readonly setupMultiplier: number;
  readonly markup: number; // markup sugerido no PF (opção Recomendado)
  readonly markupPremium: number; // markup da opção Premium
}

/**
 * Tabela de premissas versionada. O `version` + `hash` identificam univocamente o conjunto.
 * Os valores reproduzem bit-a-bit o `const C`, `PBANDS`, `BANDS`, `TIERS` e `BANDSCX` do HTML legado
 * (ver docs/01-auditoria-html-original.md).
 */
export interface PremiseTable {
  readonly version: string;
  readonly hash: string; // identidade imutável do conteúdo (preenchida por freezePremiseTable)
  readonly label: string;
  readonly effectiveDate: string;

  // Custos variáveis (R-005/R-006)
  readonly cleverTapPerMau: Premise;
  readonly invoiceReadCost: Premise; // NF
  readonly infraPerTransaction: Premise;
  readonly communicationTariffs: Premise<CommunicationTariffs>;

  // Receita (R-003/R-004)
  readonly processingPerTransaction: Premise;

  // Serviços (R-030/R-031)
  readonly dedicatedTablePrice: Premise;
  readonly hourlyRate: Premise;
  readonly serviceCompCap: Premise; // teto de Total Comp — base do custo/hora de implantação
  readonly serviceProductiveHours: Premise; // horas produtivas/mês — base do custo/hora
  readonly serviceMinMargin: Premise; // margem mínima por profissional
  readonly serviceHourMinMargin: Premise; // margem mínima por hora adicional

  // Tributos e repasses (R-022/R-023)
  readonly taxRate: Premise;
  readonly minuConversionFee: Premise;
  readonly minuAccountFee: Premise;
  readonly setupMarkup: Premise;

  // Guardrails de margem (R-018/R-019)
  readonly marginTarget: Premise;
  readonly marginFloor: Premise;

  // Descontos (R-015/R-017)
  readonly termDiscounts: Premise<Readonly<Record<12 | 24 | 36, number>>>;
  readonly discountCorridorBase: Premise;
  readonly discountCorridorStrategicStep: Premise;
  readonly discountCorridorCap: Premise;

  // Campanha (R-040)
  readonly campaignMarkup: Premise;

  // Assinaturas B2C (R-060..R-063)
  readonly b2c: {
    readonly antifraudBands: readonly Band[];
    readonly validationRate: number;
    readonly feeOptions: readonly number[];
    readonly feeDefault: number;
    readonly minFee: number;
    readonly minuShare: number;
  };

  // Faixas progressivas (R-001/R-003/R-002/R-012)
  readonly platformFeeBands: Premise<readonly Band[]>;
  readonly usageBands: Premise<readonly Band[]>;
  readonly tiers: Premise<readonly TierDefinition[]>;
  readonly complexityBands: Premise<readonly ComplexityBand[]>;
}

const SRC = 'Bondly Revenue & Pricing Simulator (tabela v15 · Simulator v1.8) — HTML V1.0';
const REF = '2026-10-01';

function p<T>(value: T, unit: string, status: PremiseStatus = 'validada'): Premise<T> {
  return { value, unit, source: SRC, referenceDate: REF, status };
}

/** Conjunto de premissas v15 — reproduz o `const C` e as tabelas do HTML legado. */
const PREMISES_V15_BASE = {
  version: 'v15',
  hash: '', // preenchido por freezePremiseTable
  label: 'Tabela padrão v15 — Simulador comercial Bondly',
  effectiveDate: REF,

  cleverTapPerMau: p(0.0633, 'R$/MAU'),
  invoiceReadCost: p(0.12, 'R$/nota'),
  infraPerTransaction: p(0.1462, 'R$/transação'),
  communicationTariffs: p<CommunicationTariffs>(
    { rcs: 0.056, wa: 0.7, sms: 0.15, email: 0.15 },
    'R$/comunicação',
  ),

  processingPerTransaction: p(0.3, 'R$/transação'),

  dedicatedTablePrice: p(35000, 'R$/profissional/mês'),
  hourlyRate: p(350, 'R$/hora'),
  serviceCompCap: p(25000, 'R$/profissional/mês — teto de Total Comp'),
  serviceProductiveHours: p(160, 'horas produtivas/mês'),
  serviceMinMargin: p(5000, 'R$/profissional/mês — margem mínima'),
  serviceHourMinMargin: p(50, 'R$/hora — margem mínima'),

  taxRate: p(0.117, 'fração sobre receita'),
  minuConversionFee: p(0.15, 'fração do Platform Fee (12m)'),
  minuAccountFee: p(0.05, 'fração do Platform Fee (prazo)'),
  setupMarkup: p(0.2, 'fração sobre o Setup'),

  marginTarget: p(0.7, 'fração — alvo'),
  marginFloor: p(0.6, 'fração — piso'),

  termDiscounts: p<Readonly<Record<12 | 24 | 36, number>>>({ 12: 0, 24: 0.05, 36: 0.1 }, 'fração sobre PF'),
  discountCorridorBase: p(0.1, 'fração'),
  discountCorridorStrategicStep: p(0.025, 'fração por gatilho'),
  discountCorridorCap: p(0.15, 'fração'),

  campaignMarkup: p(0.2, 'fração sobre a mídia'),

  b2c: {
    antifraudBands: [
      [1, 500, 0.84],
      [501, 1000, 0.74],
      [1001, 2000, 0.65],
      [2001, 5000, 0.55],
      [5001, 10000, 0.47],
      [10001, 20000, 0.38],
      [20001, 50000, 0.35],
      [50001, 100000, 0.32],
      [100001, 1e12, 0.3],
    ],
    validationRate: 0.18,
    feeOptions: [0.1, 0.125, 0.15],
    feeDefault: 0.1,
    minFee: 2,
    minuShare: 0.5,
  },

  platformFeeBands: p<readonly Band[]>(
    [
      [0, 25000, 0.5],
      [25000, 50000, 0.485],
      [50000, 150000, 0.47],
      [150000, 250000, 0.455],
      [250000, 1e12, 0.445],
    ],
    'R$/usuário por faixa',
  ),
  usageBands: p<readonly Band[]>(
    [
      [0, 5000, 0.08],
      [5000, 15000, 0.06],
      [15000, 40000, 0.045],
      [40000, 80000, 0.035],
      [80000, Infinity, 0.025],
    ],
    'R$/DAU por faixa por dia',
  ),
  tiers: p<readonly TierDefinition[]>(
    [
      { name: 'Starter', users: 25000, platformFee: 12500, setup: 40000 },
      { name: 'Growth', users: 50000, platformFee: 24625, setup: 60000 },
      { name: 'Scale', users: 150000, platformFee: 71625, setup: 100000 },
      { name: 'Enterprise', users: 250000, platformFee: 117125, setup: 140000 },
      { name: 'Enterprise+', users: 400000, platformFee: 183875, setup: 180000 },
    ],
    'tiers comerciais',
  ),
  complexityBands: p<readonly ComplexityBand[]>(
    [
      { name: 'Padrão', maxScore: 25, setupMultiplier: 1, markup: 0, markupPremium: 0.1 },
      { name: 'Avançado', maxScore: 50, setupMultiplier: 1.15, markup: 0.075, markupPremium: 0.15 },
      { name: 'Complexo', maxScore: 75, setupMultiplier: 1.3, markup: 0.15, markupPremium: 0.25 },
      {
        name: 'Estratégico / Alta complexidade',
        maxScore: 101,
        setupMultiplier: 1.5,
        markup: 0.25,
        markupPremium: 0.35,
      },
    ],
    'bandas de complexidade',
  ),
} satisfies PremiseTable;

/**
 * Hash determinístico simples (FNV-1a) do conteúdo serializado — identidade imutável do snapshot.
 * Não é criptográfico; serve para detectar mudança de premissas entre propostas (prompt §27.6).
 */
export function hashPremiseTable(table: PremiseTable | Omit<PremiseTable, 'hash'>): string {
  const { hash: _ignored, ...rest } = table as PremiseTable;
  const json = JSON.stringify(rest, (_k, v) => (v === Infinity ? '__Infinity__' : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Congela a tabela e grava seu hash — produz o snapshot imutável citado no §27.6. */
export function freezePremiseTable(table: PremiseTable | Omit<PremiseTable, 'hash'>): PremiseTable {
  const hash = hashPremiseTable(table);
  return Object.freeze({ ...table, hash }) as PremiseTable;
}

/** Tabela de premissas ativa (v15), já congelada com hash. */
export const PREMISES_V15: PremiseTable = freezePremiseTable(PREMISES_V15_BASE);

/** Versão corrente padrão do motor. */
export const CURRENT_PREMISES = PREMISES_V15;
