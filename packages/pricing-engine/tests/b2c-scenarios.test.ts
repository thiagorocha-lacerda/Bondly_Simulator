import { describe, it, expect } from 'vitest';
import { runB2c, normalizeB2cInput, defaultScenarios, CURRENT_PREMISES } from '../src/index.js';
import type { PricingInput } from '../src/index.js';

describe('B2C — assinaturas (R-060..R-063)', () => {
  const base = normalizeB2cInput({
    som: 2_400_000,
    conv: 0.01,
    ticket: 10,
    churn: 0.08,
    fee: 0.1,
    gateway: 0.05,
    tax: 0.15,
    minFee: 2,
    minuShare: 0.5,
    commission: 0,
    method: 'progressiva',
    scope: 'primeira',
    validation: 0,
    cardReuse: 0.005,
    setup: 3000,
    minMargin: 1500,
    addCost: 0,
    weights: [10, 14, 17, 19, 20, 20],
  });

  it('a curva escala para atingir a meta de conversão em dezembro', () => {
    const r = runB2c(base);
    expect(r.rows.length).toBe(6);
    // base final ≈ SOM × conv = 24.000 (tolerância pela aproximação da curva/churn)
    expect(r.tot.end).toBeGreaterThan(20000);
    expect(r.tot.end).toBeLessThan(28000);
  });

  it('com ticket R$10 e fee 10%, o mínimo de R$2 prevalece (fee efetivo = R$2)', () => {
    const r = runB2c(base);
    // receita de processamento ≈ assinaturas faturadas × R$2 ⇒ rev > rev10 (percentual puro)
    expect(r.tot.rev).toBeGreaterThan(r.tot.rev10);
  });

  it('o split Minu é apurado mês a mês só sobre margem positiva', () => {
    const r = runB2c(base);
    for (const row of r.rows) {
      expect(row.minu).toBeGreaterThanOrEqual(0);
      if (row.margin <= 0) expect(row.minu).toBe(0);
    }
  });

  it('é determinístico', () => {
    expect(runB2c(base)).toEqual(runB2c(base));
  });

  it('usa as faixas de antifraude das premissas v15', () => {
    expect(CURRENT_PREMISES.b2c.antifraudBands.length).toBe(9);
    expect(CURRENT_PREMISES.b2c.feeDefault).toBe(0.1);
  });
});

describe('Cenários (§13)', () => {
  const input: PricingInput = {
    volume: { users: 50000, mauPct: 0.4, stickiness: 0.15, transactionsPerMau: 1 },
    invoices: { enabled: true, participantPct: 0.1, notesPerParticipant: 1 },
    communication: { perMau: 1, strategy: 'fallback', fallbackRate: 0.4, customMix: { sms: 0, email: 0, rcs: 1, wa: 0.4 } },
    complexity: { integrations: 1, modules: 2, slaPoints: 0, customizationPoints: 0, aiPoints: 0, migrationPoints: 0, implementationHours: 0 },
    negotiation: { option: 'recommended', extraDiscount: 0, term: 12, viaMinu: true, expansion: false, strategic: false },
    services: { profiles: [], tablePrice: 35000, minMargin: 5000, compCap: 25000, targetMargin: undefined, passthroughPct: 0, startMonth: 1, hourMinMargin: 50, productiveHoursPerMonth: 160, hourCost: undefined, negotiatedHourPrice: undefined },
    campaign: { enabled: false, objectives: [], base: undefined, consentPct: 0, frequency: 1, months: 2, mix: { sms: 0, email: 0, rcs: 1, wa: 0.4 }, deliveryRate: { sms: 0.7, email: 0.7, rcs: 0.7, wa: 0.7 }, conversionRate: 0.35, activationRate: 0.15, operationHours: 0, markup: 0.2 },
  };

  it('conservador/base/otimista usam o mesmo motor e ordenam-se por Core', () => {
    const [cons, b, otim] = defaultScenarios(input);
    expect(cons!.result.core).toBeLessThan(b!.result.core);
    expect(otim!.result.core).toBeGreaterThan(b!.result.core);
  });
});
