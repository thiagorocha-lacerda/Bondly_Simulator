/** Setup (R-021) e fees da Minu (R-023/R-027/R-028). */
import type { CommercialOption } from '../contracts/types.js';
import type { ComplexityResult } from './complexity.js';

export interface SetupResult {
  readonly recurring: number; // tier.setup × banda
  readonly table: number; // ajustado por opção comercial
  readonly net: number; // líquido Bondly (+ horas de implantação)
  readonly client: number; // ao cliente (+markup Minu se via)
}

/**
 * Setup (R-021), reproduzindo `calc()`:
 *   setupRec   = tier.setup × banda.setupMultiplier
 *   setupTable = piso: tier.setup×0.9 · recomendado: setupRec · premium: setupRec×1.15
 *   setupNet   = setupTable + implCost (horas × preço/hora)
 *   setupClient= setupNet × (via ? 1.2 : 1)
 */
export function setup(args: {
  tierSetup: number;
  complexity: ComplexityResult;
  option: CommercialOption;
  implementationCost: number;
  viaMinu: boolean;
  setupMarkup: number;
}): SetupResult {
  const { tierSetup, complexity, option, implementationCost, viaMinu, setupMarkup } = args;
  const recurring = tierSetup * complexity.band.setupMultiplier;
  const table = option === 'floor' ? tierSetup * 0.9 : option === 'recommended' ? recurring : recurring * 1.15;
  const net = table + implementationCost;
  const client = net * (viaMinu ? 1 + setupMarkup : 1);
  return { recurring, table, net, client };
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
