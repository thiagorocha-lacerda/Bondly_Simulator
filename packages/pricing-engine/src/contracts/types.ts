/**
 * Contratos de dados do Pricing Engine (prompt §5.1).
 * Interfaces estáveis de entrada/saída — a fronteira pública que CRM, portal de parceiros e a app
 * comercial consomem (prompt §21). Nenhum tipo depende de React/DOM.
 */

export type ContractMonths = 12 | 24 | 36;
export type CommercialOption = 'floor' | 'recommended' | 'premium';
export type CommunicationStrategy =
  | 'rcs'
  | 'wa'
  | 'sms'
  | 'email'
  | 'both' // RCS + WhatsApp para todo o volume
  | 'fallback' // RCS + WhatsApp como fallback
  | 'custom' // mix por canal
  | 'none';

/** Mix percentual por canal (frações [0,1]); usado na estratégia 'custom'. */
export interface ChannelMix {
  readonly sms: number;
  readonly email: number;
  readonly rcs: number;
  readonly wa: number;
}

/** Parâmetros de volumetria e engajamento ("O cliente"). */
export interface VolumeParameters {
  readonly users: number; // base elegível
  readonly mauPct: number; // fração [0,1]
  readonly stickiness: number; // fração [0,1]
  readonly transactionsPerMau: number;
}

/** Parâmetros de leitura de notas fiscais. */
export interface InvoiceParameters {
  readonly enabled: boolean;
  readonly participantPct: number; // fração [0,1] dos MAU que enviam
  readonly notesPerParticipant: number; // inteiro
}

/** Parâmetros de comunicação transacional/engajamento. */
export interface CommunicationParameters {
  readonly perMau: number; // comunicações por MAU no mês
  readonly strategy: CommunicationStrategy;
  readonly fallbackRate: number; // fração [0,1] (estratégia 'fallback')
  readonly customMix: ChannelMix; // (estratégia 'custom')
}

/** Parâmetros de complexidade da implementação. */
export interface ComplexityParameters {
  readonly integrations: number;
  readonly modules: number;
  readonly slaPoints: number; // 0 | 7.5 | 15
  readonly customizationPoints: number; // 0 | 10 | 20
  readonly aiPoints: number; // 0 | 7.5 | 15
  readonly migrationPoints: number; // 0 | 7.5 | 15
  readonly implementationHours: number; // horas adicionais (entram só no Setup)
}

/** Parâmetros da negociação. */
export interface NegotiationParameters {
  readonly option: CommercialOption;
  readonly extraDiscount: number; // fração [0,1] sobre o PF
  /**
   * Desconto POR TIER (§3.1), fração [0,1]. Editável 3%–7% (limites em premises.tierDiscountLimits).
   * 0 ou ausente = sem desconto por tier. Incide só sobre o Platform Fee, antes do desconto
   * negociado e do desconto por prazo. A UI valida com validateTierDiscountPct; o engine reaplica
   * o limite (clamp) como fronteira do contrato público.
   */
  readonly tierDiscount?: number;
  readonly term: ContractMonths;
  readonly viaMinu: boolean;
  readonly expansion: boolean; // potencial de expansão alto
  readonly strategic: boolean; // cliente estratégico
}

/** Um perfil de recurso dedicado. */
export interface DedicatedProfile {
  readonly name: string;
  readonly quantity: number;
  readonly totalCompensation: number; // Total Comp unitário/mês
  readonly directCosts: number; // custos diretos adicionais
  readonly tablePrice?: number; // vazio = preço de tabela padrão
  readonly negotiatedPrice?: number; // vazio = PCS
}

/** Parâmetros de serviços (recursos dedicados + horas). */
export interface ServiceParameters {
  readonly profiles: readonly DedicatedProfile[];
  readonly tablePrice: number; // premissa (default 35000)
  readonly minMargin: number; // default 5000
  readonly compCap: number; // teto de Total Comp (default 25000)
  readonly targetMargin?: number | undefined; // vazio = margem no PCS
  readonly passthroughPct: number; // repasses sobre serviços, fração [0,1]
  readonly startMonth: number; // mês de início em 2027 (1–12)
  readonly hourMinMargin: number; // default 50
  readonly productiveHoursPerMonth: number; // default 160
  readonly hourCost?: number | undefined; // vazio = cap/horas produtivas
  readonly negotiatedHourPrice?: number | undefined; // vazio = PCS da hora
}

/** Objetivos de campanha. */
export type CampaignObjective = 'Aquisição' | 'Ativação' | 'Conversão' | 'Engajamento';

/** Parâmetros da campanha de marketing (serviço à parte, fora do ARR). */
export interface CampaignParameters {
  readonly enabled: boolean;
  readonly objectives: readonly CampaignObjective[];
  readonly base?: number | undefined; // vazio = usuários elegíveis
  readonly consentPct: number; // fração [0,1]
  readonly frequency: number; // disparos por contato habilitado/mês
  readonly months: number; // limitado ao prazo
  readonly mix: ChannelMix; // % dos contatos habilitados
  readonly deliveryRate: { readonly sms: number; readonly email: number; readonly rcs: number; readonly wa: number };
  readonly conversionRate: number; // fração [0,1]
  readonly activationRate: number; // fração [0,1]
  readonly operationHours: number; // horas de operação/mês
  readonly markup: number; // fração [0,1] sobre a mídia
}

/** Evidência ARKA. */
export interface ArkaParameters {
  readonly clientName: string;
  readonly goLiveDate: string;
  readonly owner: string;
  readonly evidenceStage: number; // 1..15
  readonly probability: number; // 0..100
}

/** Entrada completa do Pricing Engine. */
export interface PricingInput {
  readonly volume: VolumeParameters;
  readonly invoices: InvoiceParameters;
  readonly communication: CommunicationParameters;
  readonly complexity: ComplexityParameters;
  readonly negotiation: NegotiationParameters;
  readonly services: ServiceParameters;
  readonly campaign: CampaignParameters;
  readonly arka?: ArkaParameters | undefined;
}

/** Detalhamento de custos variáveis. */
export interface CostBreakdown {
  readonly cleverTap: number;
  readonly infra: number;
  readonly invoices: number;
  readonly communication: number;
  readonly total: number;
}

/** Detalhamento de tributos. */
export interface TaxBreakdown {
  readonly rate: number;
  readonly onCore: number;
  readonly onServices: number;
  readonly total: number;
}

export type MarginStatus = 'SAUDÁVEL' | 'REVISAR' | 'REPRECIFICAR' | 'CUSTOMIZADO' | 'INCOMPLETO';

export interface PricingWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warn' | 'error';
}

/**
 * Waterfall comercial do Platform Fee (§3.2.4): base escolhida → desconto por tier → desconto
 * negociado → desconto por prazo → final. Cada degrau carrega a fração aplicada e o valor após ele,
 * para a UI e o PDF mostrarem a composição sem recalcular.
 */
export interface DiscountWaterfall {
  readonly base: number; // Platform Fee escolhido (antes de qualquer desconto)
  readonly tierDiscountRate: number; // fração
  readonly afterTierDiscount: number;
  readonly commercialDiscountRate: number; // "extraDiscount" (desconto negociado)
  readonly afterCommercialDiscount: number;
  readonly termDiscountRate: number; // fração
  readonly final: number; // Platform Fee final
}

/** Resultado completo do Pricing Engine. */
export interface PricingResult {
  readonly engineVersion: string;
  readonly premisesVersion: string;
  readonly premisesHash: string;

  readonly tierName: string;
  readonly isCustom: boolean;

  readonly mau: number;
  readonly dau: number;

  readonly platformFeeTable: number;
  readonly platformFee: number;
  readonly usage: number;
  readonly processing: number;
  readonly core: number; // Core MRR

  readonly costs: CostBreakdown;
  readonly servicesMrr: number;

  readonly setupNet: number;
  readonly setupClient: number;

  readonly taxes: TaxBreakdown;
  readonly minuConversionFee: number;
  readonly minuAccountFee: number;

  readonly technicalMargin: number;
  readonly netMarginY1: number;
  readonly netMarginSteady: number;
  readonly marginStatus: MarginStatus;

  readonly discountAuthority: string;
  readonly maxDiscount: number;
  readonly termDiscount: number;
  /** Desconto por tier aplicado (§3.1), fração [0,1]; 0 = não aplicado. */
  readonly tierDiscount: number;
  readonly tierDiscountApplied: boolean;
  /** Waterfall do Platform Fee para transparência na UI/PDF (§3.2.4 / §9). */
  readonly discountWaterfall: DiscountWaterfall;

  readonly tcvClient: number;
  readonly tcvBondly: number;
  readonly contractContribution: number;
  readonly contractMargin: number;

  readonly clientYear1: number;
  readonly minuYear1: number;
  readonly minuContract: number;

  readonly complexityScore: number;
  readonly complexityBand: string;

  readonly warnings: readonly PricingWarning[];
}
