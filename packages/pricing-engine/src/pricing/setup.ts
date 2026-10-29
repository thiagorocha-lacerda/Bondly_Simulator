/** Setup (R-021) e fees da Minu (R-023/R-027/R-028). */
import type { CommercialOption } from '../contracts/types.js';
import type { ComplexityResult } from './complexity.js';

export interface SetupResult {
  readonly recurring: number; // tier.setup × banda (base de referência antes da opção comercial)
  readonly fixed: number; // Setup fixo padrão (ajustado por opção comercial e redução configurável)
  readonly implementationHours: number; // horas adicionais de implantação
  readonly hourlyRate: number; // R$/HH praticado (default R$ 350)
  readonly implementationSubtotal: number; // horas × R$/HH — entra SÓ no Setup (§4.1)
  readonly otherAdditions: number; // outros adicionais de Setup expressamente previstos (§4.1)
  readonly fixedReductionPct: number; // fração de redução aplicada ao fixo (0 = sem redução)
  readonly table: number; // = fixed (compat: "Setup de tabela" = o fixo padrão)
  readonly net: number; // líquido Bondly = fixed + implementação + outros
  readonly client: number; // ao cliente (+markup Minu se via)
}

/**
 * Setup (R-021 + §4.1), decomposto explicitamente:
 *
 *   Setup total (net) = Setup fixo padrão + (Horas × R$/HH) + outros adicionais de Setup
 *
 *   setupRec   = tier.setup × banda.setupMultiplier               (base de referência)
 *   fixedBase  = piso: tier.setup×0.9 · recomendado: setupRec · premium: setupRec×1.15
 *   fixed      = fixedBase × (1 − fixedReductionPct)              (§4.1: fixo mais acessível, CONFIGURÁVEL)
 *   implSubtot = implementationHours × hourlyRate                 (§4.1: horas entram SÓ no Setup)
 *   net        = fixed + implSubtot + otherAdditions
 *   setupClient= net × (via ? 1+markup : 1)
 *
 * IMPORTANTE (§4.1): `fixedReductionPct` default 0 e `otherAdditions` default 0 preservam o cálculo
 * legado bit-a-bit (paridade §22). O novo valor fixo reduzido NÃO é inventado aqui — é uma decisão
 * comercial pendente; o engine só oferece o parâmetro configurável e o default mantém o valor atual.
 */
export function setup(args: {
  tierSetup: number;
  complexity: ComplexityResult;
  option: CommercialOption;
  implementationCost: number;
  viaMinu: boolean;
  setupMarkup: number;
  implementationHours?: number | undefined;
  hourlyRate?: number | undefined;
  otherAdditions?: number | undefined;
  fixedReductionPct?: number | undefined;
}): SetupResult {
  const { tierSetup, complexity, option, implementationCost, viaMinu, setupMarkup } = args;
  const fixedReductionPct = Math.max(0, Math.min(1, args.fixedReductionPct ?? 0));
  const otherAdditions = Math.max(0, args.otherAdditions ?? 0);
  const recurring = tierSetup * complexity.band.setupMultiplier;
  const fixedBase = option === 'floor' ? tierSetup * 0.9 : option === 'recommended' ? recurring : recurring * 1.15;
  const fixed = fixedBase * (1 - fixedReductionPct);
  // Subtotal de implantação. implementationCost (horas × preço/hora resolvido em services) é a fonte
  // de verdade do valor; horas/preço são expostos para transparência (§4.2).
  const implementationSubtotal = implementationCost;
  const implementationHours = Math.max(0, args.implementationHours ?? 0);
  const hourlyRate = implementationHours > 0 ? implementationSubtotal / implementationHours : args.hourlyRate ?? 0;
  const net = fixed + implementationSubtotal + otherAdditions;
  const client = net * (viaMinu ? 1 + setupMarkup : 1);
  return {
    recurring,
    fixed,
    implementationHours,
    hourlyRate,
    implementationSubtotal,
    otherAdditions,
    fixedReductionPct,
    table: fixed,
    net,
    client,
  };
}

export interface MinuFees {
  readonly conversionFee: number; // mensal (12m)
  readonly accountFee: number; // mensal (prazo)
  readonly year1: number; // (conv+am)×12 + setupNet×markup
  readonly contract: number; // conv×min(12,prazo) + am×prazo + setupNet×markup
}

/** Fees da Minu (R-023/R-027/R-028). */
export function minuFees(args: {
  viaMinu: boolean;
  platformFee: number;
  conversionRate: number;
  accountRate: number;
  setupNet: number;
  setupMarkup: number;
  term: number;
}): MinuFees {
  const { viaMinu, platformFee, conversionRate, accountRate, setupNet, setupMarkup, term } = args;
  const conversionFee = viaMinu ? platformFee * conversionRate : 0;
  const accountFee = viaMinu ? platformFee * accountRate : 0;
  const year1 = viaMinu ? (conversionFee + accountFee) * 12 + setupNet * setupMarkup : 0;
  const contract = viaMinu ? conversionFee * Math.min(12, term) + accountFee * term + setupNet * setupMarkup : 0;
  return { conversionFee, accountFee, year1, contract };
}
