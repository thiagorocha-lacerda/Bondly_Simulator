/** Campanha de marketing (R-040) — serviço à parte, fora do ARR. Reproduz `campaign()`. */
import type { CampaignParameters } from '../contracts/types.js';
import type { CommunicationTariffs } from '../premises/premises.js';

type ChannelKey = 'sms' | 'email' | 'rcs' | 'wa';

export interface CampaignResult {
  readonly on: boolean;
  readonly base: number;
  readonly consent: number;
  readonly habilitated: number;
  readonly months: number;
  readonly sends: number;
  readonly media: number;
  readonly delivered: number;
  readonly acquired: number;
  readonly activated: number;
  readonly price: number; // venda da mídia
  readonly gross: number;
  readonly grossPct: number;
  readonly revenue: number;
  readonly tax: number;
  readonly contribution: number;
  readonly margin: number;
  readonly deliveryRate: number;
  readonly cac: number;
  readonly costPerDelivered: number;
  readonly costPerActivated: number;
  readonly revenueYear1: number;
  readonly contributionYear1: number;
  readonly markupBreakeven: number;
}

/**
 * Campanha (R-040). Para cada canal: sends = hab×freq×meses×mix; media = sends×tarifa; deliv = sends×entrega.
 * rev = media×(1+markup) + horas×preço/hora; contrib = rev − media − rev×tax.
 * Funil: deliv → acq (×conv) → act (×ativ). Y1 = min(12,meses)/meses.
 */
export function campaign(args: {
  params: CampaignParameters;
  eligibleUsers: number;
  term: number;
  tariffs: CommunicationTariffs;
  taxRate: number;
  hourlyRate: number;
}): CampaignResult {
  const { params, eligibleUsers, term, tariffs, taxRate, hourlyRate } = args;
  const on = params.enabled;
  const base = params.base == null ? eligibleUsers : Math.max(0, params.base);
  const consent = Math.min(1, Math.max(0, params.consentPct));
  const hab = on ? base * consent : 0;
  const months = on ? Math.min(Math.max(0, params.months), term) : 0;
  const freq = Math.max(0, params.frequency);

  const channels: ChannelKey[] = ['sms', 'email', 'rcs', 'wa'];
  let sends = 0;
  let media = 0;
  let delivered = 0;
  for (const c of channels) {
    const s = hab * freq * months * params.mix[c];
    sends += s;
    media += s * tariffs[c];
    delivered += s * Math.min(1, Math.max(0, params.deliveryRate[c]));
  }

  const acquired = delivered * Math.max(0, params.conversionRate);
  const activated = acquired * Math.max(0, params.activationRate);
  const hoursRev = on ? Math.max(0, params.operationHours) * months * hourlyRate : 0;
  const mk = Math.max(0, params.markup);
  const revenue = media * (1 + mk) + hoursRev;
  const tax = revenue * taxRate;
  const contribution = revenue - media - tax;
  const y1 = months > 0 ? Math.min(12, months) / months : 0;
  const price = media * (1 + mk);
  const gross = price - media;

  return {
    on,
    base,
    consent,
    habilitated: hab,
    months,
    sends,
    media,
    delivered,
    acquired,
    activated,
    price,
    gross,
    grossPct: price > 0 ? gross / price : 0,
    revenue,
    tax,
    contribution,
    margin: revenue > 0 ? contribution / revenue : 0,
    deliveryRate: sends > 0 ? delivered / sends : 0,
    cac: acquired > 0 ? media / acquired : 0,
    costPerDelivered: delivered > 0 ? media / delivered : 0,
    costPerActivated: activated > 0 ? media / activated : 0,
    revenueYear1: revenue * y1,
    contributionYear1: contribution * y1,
    markupBreakeven: media > 0 ? Math.max(0, (media / (1 - taxRate) - hoursRev) / media - 1) : 0,
  };
}
