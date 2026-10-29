import { describe, it, expect } from 'vitest';
import { calculate, setup, complexity as computeComplexity, CURRENT_PREMISES, type PricingInput } from '../src/index.js';

const P = CURRENT_PREMISES;

function baseInput(neg?: Partial<PricingInput['negotiation']>, implHours = 0): PricingInput {
  return {
    volume: { users: 50000, mauPct: 0.4, stickiness: 0.15, transactionsPerMau: 1 },
    invoices: { enabled: true, participantPct: 0.1, notesPerParticipant: 1 },
    communication: { perMau: 1, strategy: 'fallback', fallbackRate: 0.4, customMix: { sms: 0, email: 0, rcs: 1, wa: 0.4 } },
    complexity: { integrations: 1, modules: 2, slaPoints: 0, customizationPoints: 0, aiPoints: 0, migrationPoints: 0, implementationHours: implHours },
    negotiation: { option: 'recommended', extraDiscount: 0, term: 12, viaMinu: true, expansion: false, strategic: false, ...neg },
    services: {
      profiles: [], tablePrice: 35000, minMargin: 5000, compCap: 25000, targetMargin: undefined,
      passthroughPct: 0, startMonth: 1, hourMinMargin: 50, productiveHoursPerMonth: 160, hourCost: undefined, negotiatedHourPrice: undefined,
    },
    campaign: {
      enabled: false, objectives: [], base: undefined, consentPct: 0, frequency: 1, months: 2,
      mix: { sms: 0, email: 0, rcs: 1, wa: 0.4 }, deliveryRate: { sms: 0.7, email: 0.7, rcs: 0.7, wa: 0.7 },
      conversionRate: 0.35, activationRate: 0.15, operationHours: 0, markup: 0.2,
    },
  };
}

describe('Setup — função decomposta (§4.1)', () => {
  const cx = computeComplexity(baseInput().complexity, P.complexityBands.value);
  const common = { tierSetup: 60000, complexity: cx, option: 'recommended' as const, viaMinu: false, setupMarkup: 0.2 };

  it('net = fixo + implementação + outros; defaults (red 0, outros 0) preservam o legado', () => {
    const r = setup({ ...common, implementationCost: 0 });
    expect(r.fixed).toBeCloseTo(60000, 6); // recommended = tierSetup × setupMultiplier(1 p/ Padrão)
    expect(r.net).toBeCloseTo(60000, 6);
    expect(r.otherAdditions).toBe(0);
    expect(r.fixedReductionPct).toBe(0);
  });

  it('fixo + N horas × R$/HH entra no net', () => {
    const r = setup({ ...common, implementationCost: 40 * 350, implementationHours: 40, hourlyRate: 350 });
    expect(r.implementationSubtotal).toBeCloseTo(14000, 6);
    expect(r.hourlyRate).toBeCloseTo(350, 6);
    expect(r.net).toBeCloseTo(60000 + 14000, 6);
  });

  it('redução configurável do fixo reduz só o fixo; outros adicionais somam ao net', () => {
    const r = setup({ ...common, implementationCost: 0, fixedReductionPct: 0.2, otherAdditions: 5000 });
    expect(r.fixed).toBeCloseTo(48000, 6); // 60000 × 0.8
    expect(r.net).toBeCloseTo(48000 + 5000, 6);
  });
});

describe('Setup no engine — horas entram SÓ no Setup (§4.1 / §11)', () => {
  it('HH não altera Capacity Fee nem mensalidade (core), só o Setup e o TCV', () => {
    const noH = calculate(baseInput({}, 0));
    const withH = calculate(baseInput({}, 40));
    // core (mensalidade recorrente) idêntico
    expect(withH.core).toBeCloseTo(noH.core, 6);
    expect(withH.platformFee).toBeCloseTo(noH.platformFee, 6);
    // setup cresce exatamente 40 × R$/HH
    expect(withH.setup.implementationSubtotal).toBeCloseTo(40 * withH.setup.hourlyRate, 6);
    expect(withH.setupNet - noH.setupNet).toBeCloseTo(withH.setup.implementationSubtotal, 6);
  });

  it('HH aparece UMA ÚNICA VEZ: a diferença no TCV Bondly é exatamente o subtotal de implantação', () => {
    const noH = calculate(baseInput({}, 0));
    const withH = calculate(baseInput({}, 40));
    expect(withH.tcvBondly - noH.tcvBondly).toBeCloseTo(withH.setup.implementationSubtotal, 4);
  });

  it('breakdown do Setup bate com setupNet/setupClient', () => {
    const r = calculate(baseInput({}, 40));
    expect(r.setup.fixed + r.setup.implementationSubtotal + r.setup.otherAdditions).toBeCloseTo(r.setupNet, 6);
    expect(r.setup.client).toBeCloseTo(r.setupClient, 6);
    expect(r.setup.hourlyRate).toBeCloseTo(350, 6); // default R$ 350/HH
  });
});

describe('Setup — redução e outros adicionais no engine (§4.1/§4.2)', () => {
  it('redução do fixo gera warning SETUP_FIXED_REDUCTION_PENDING e reduz o Setup', () => {
    const baseR = calculate(baseInput({}, 0));
    const reduced = calculate(baseInput({ setupFixedReductionPct: 0.2 }, 0));
    expect(reduced.setupNet).toBeLessThan(baseR.setupNet);
    expect(reduced.warnings.some((w) => w.code === 'SETUP_FIXED_REDUCTION_PENDING')).toBe(true);
  });

  it('outros adicionais somam ao Setup sem tocar a mensalidade', () => {
    const baseR = calculate(baseInput({}, 0));
    const withOther = calculate(baseInput({ setupOtherAdditions: 8000 }, 0));
    expect(withOther.setupNet - baseR.setupNet).toBeCloseTo(8000, 6);
    expect(withOther.core).toBeCloseTo(baseR.core, 6);
  });

  it('sem redução/outros: Setup idêntico ao cálculo legado (paridade preservada)', () => {
    const r = calculate(baseInput({}, 40));
    const legacyNet = r.setup.fixed + 40 * r.setup.hourlyRate; // fixed + impl, sem outros
    expect(r.setupNet).toBeCloseTo(legacyNet, 6);
    expect(r.setup.otherAdditions).toBe(0);
    expect(r.setup.fixedReductionPct).toBe(0);
  });
});
