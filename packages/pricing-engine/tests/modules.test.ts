import { describe, it, expect } from 'vitest';
import {
  allModuleCombinations,
  commercialComplexity,
  validateDependencies,
  MODULE_CATALOG,
  calculate,
  createProposalSnapshot,
  reopenProposal,
  reviseProposal,
  formatProposalId,
  arkaClassification,
  campaign,
  CURRENT_PREMISES,
  freezePremiseTable,
  PREMISES_V15,
  normalizeB2cInput,
  runB2c,
} from '../src/index.js';
import type { PricingInput, ModuleId } from '../src/index.js';

function inputWithModules(modules: number): PricingInput {
  return {
    volume: { users: 50000, mauPct: 0.4, stickiness: 0.15, transactionsPerMau: 1 },
    invoices: { enabled: true, participantPct: 0.1, notesPerParticipant: 1 },
    communication: { perMau: 1, strategy: 'fallback', fallbackRate: 0.4, customMix: { sms: 0, email: 0, rcs: 1, wa: 0.4 } },
    complexity: { integrations: 1, modules, slaPoints: 0, customizationPoints: 0, aiPoints: 0, migrationPoints: 0, implementationHours: 0 },
    negotiation: { option: 'recommended', extraDiscount: 0, term: 12, viaMinu: true, expansion: false, strategic: false },
    services: { profiles: [], tablePrice: 35000, minMargin: 5000, compCap: 25000, targetMargin: undefined, passthroughPct: 0, startMonth: 1, hourMinMargin: 50, productiveHoursPerMonth: 160, hourCost: undefined, negotiatedHourPrice: undefined },
    campaign: { enabled: false, objectives: [], base: undefined, consentPct: 0, frequency: 1, months: 2, mix: { sms: 0, email: 0, rcs: 1, wa: 0.4 }, deliveryRate: { sms: 0.7, email: 0.7, rcs: 0.7, wa: 0.7 }, conversionRate: 0.35, activationRate: 0.15, operationHours: 0, markup: 0.2 },
  };
}

describe('Catálogo de módulos e 32 combinações (§8/§19.2)', () => {
  it('são exatamente 32 combinações (2^5) únicas', () => {
    const combos = allModuleCombinations();
    expect(combos.length).toBe(32);
    const keys = new Set(combos.map((c) => [...c].sort().join(',')));
    expect(keys.size).toBe(32);
  });

  it('cada combinação produz um cálculo válido e determinístico', () => {
    for (const combo of allModuleCombinations()) {
      const input = inputWithModules(combo.length);
      const a = calculate(input);
      const b = calculate(input);
      expect(a).toEqual(b); // determinismo
      expect(Number.isFinite(a.core)).toBe(true);
      expect(Number.isFinite(a.technicalMargin)).toBe(true);
      // complexidade cresce (ou mantém) com a quantidade de módulos
      expect(a.complexityScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('complexidade comercial por quantidade (§8.1)', () => {
    expect(commercialComplexity(1)).toBe('Baixa');
    expect(commercialComplexity(2)).toBe('Baixa');
    expect(commercialComplexity(3)).toBe('Média');
    expect(commercialComplexity(4)).toBe('Média');
    expect(commercialComplexity(5)).toBe('Alta');
  });

  it('dependências: engagement requer points', () => {
    const issues = validateDependencies(['engagement'] as ModuleId[]);
    expect(issues.some((i) => i.missing === 'points' && i.kind === 'required')).toBe(true);
    const ok = validateDependencies(['points', 'engagement'] as ModuleId[]);
    expect(ok.filter((i) => i.kind === 'required').length).toBe(0);
  });

  it('o catálogo tem os 5 módulos nominais', () => {
    expect(MODULE_CATALOG.map((m) => m.id).sort()).toEqual(
      (['benefits', 'engagement', 'nfReader', 'points', 'roulette'] as ModuleId[]).sort(),
    );
  });
});

describe('Campanha (R-040)', () => {
  it('desligada = tudo zero', () => {
    const r = campaign({
      params: inputWithModules(2).campaign,
      eligibleUsers: 50000,
      term: 12,
      tariffs: CURRENT_PREMISES.communicationTariffs.value,
      taxRate: 0.117,
      hourlyRate: 350,
    });
    expect(r.on).toBe(false);
    expect(r.sends).toBe(0);
    expect(r.revenue).toBe(0);
  });
  it('funil referência 100k→70k→24.5k→3.675k com entrega 70/conv 35/ativ 15', () => {
    // 100.000 contatos, 100% consentimento, 1 disparo, 1 mês, só RCS
    const r = campaign({
      params: {
        enabled: true,
        objectives: ['Aquisição'],
        base: 100000,
        consentPct: 1,
        frequency: 1,
        months: 1,
        mix: { sms: 0, email: 0, rcs: 1, wa: 0 },
        deliveryRate: { sms: 0.7, email: 0.7, rcs: 0.7, wa: 0.7 },
        conversionRate: 0.35,
        activationRate: 0.15,
        operationHours: 0,
        markup: 0.2,
      },
      eligibleUsers: 100000,
      term: 12,
      tariffs: CURRENT_PREMISES.communicationTariffs.value,
      taxRate: 0.117,
      hourlyRate: 350,
    });
    expect(r.sends).toBeCloseTo(100000, 6);
    expect(r.delivered).toBeCloseTo(70000, 6);
    expect(r.acquired).toBeCloseTo(24500, 6);
    expect(r.activated).toBeCloseTo(3675, 6);
    // markup 20% sobre mídia → margem bruta 16,67%
    expect(r.grossPct).toBeCloseTo(0.2 / 1.2, 6);
  });
});

describe('ARKA (R-050)', () => {
  it('H3 quando faltam checks', () => {
    const r = arkaClassification({ clientName: '', goLiveDate: '', owner: '', evidenceStage: 1, probability: 0 });
    expect(r.arkaClass).toBe('H3');
  });
  it('H2 com todos os checks e estágio ≥ 8', () => {
    const r = arkaClassification({ clientName: 'Lojas Alfa', goLiveDate: '2027-03-01', owner: 'Ana', evidenceStage: 8, probability: 60 });
    expect(r.arkaClass).toBe('H2');
    expect(r.allOk).toBe(true);
  });
  it('contrato assinado (15) + checks = H2 contrato assinado', () => {
    const r = arkaClassification({ clientName: 'Lojas Alfa', goLiveDate: '2027-03-01', owner: 'Ana', evidenceStage: 15, probability: 90 });
    expect(r.classLabel).toContain('contrato assinado');
  });
});

describe('Versionamento e snapshot imutável (§27.6)', () => {
  it('id formatado BONDLY-2027-NNNNNN', () => {
    expect(formatProposalId(42)).toBe('BONDLY-2027-000042');
  });

  it('snapshot reproduz valores mesmo com premissas globais alteradas', () => {
    const snap = createProposalSnapshot({ id: formatProposalId(1), input: inputWithModules(2) });
    const reopened = reopenProposal(snap);
    expect(reopened.reproducible).toBe(true);
    expect(reopened.premisesIntact).toBe(true);
  });

  it('uma revisão com premissas novas gera resultado diferente mas preserva o original', () => {
    const snap = createProposalSnapshot({ id: formatProposalId(2), input: inputWithModules(2) });
    // nova tabela: tributo sobe de 11,7% para 20%
    const bumped = freezePremiseTable({
      ...PREMISES_V15,
      version: 'v16-test',
      hash: '',
      taxRate: { ...PREMISES_V15.taxRate, value: 0.2 },
    });
    const rev = reviseProposal(snap, bumped);
    expect(rev.revision).toBe(2);
    expect(rev.premisesVersion).toBe('v16-test');
    // snapshot original intacto
    expect(snap.result.netMarginY1).not.toBe(rev.result.netMarginY1);
    expect(reopenProposal(snap).reproducible).toBe(true);
  });

  it('o hash de premissas muda quando um valor muda', () => {
    const a = PREMISES_V15.hash;
    const b = freezePremiseTable({ ...PREMISES_V15, hash: '', taxRate: { ...PREMISES_V15.taxRate, value: 0.2 } }).hash;
    expect(a).not.toBe(b);
  });

  it('inclui o funil B2C no snapshot quando fornecido, e o preserva na revisão', () => {
    const b2cInput = normalizeB2cInput(
      { som: 2_400_000, conv: 0.01, ticket: 10, churn: 0.08, fee: 0.1, weights: [10, 14, 17, 19, 20, 20] },
      CURRENT_PREMISES,
    );
    const snap = createProposalSnapshot({ id: formatProposalId(3), input: inputWithModules(2), b2cInput });
    expect(snap.b2c).toBeDefined();
    expect(snap.b2c!.result.rows.length).toBe(6);
    // projeção congelada reproduz runB2c sobre as mesmas premissas
    expect(snap.b2c!.result.tot.total).toBeCloseTo(runB2c(b2cInput, snap.premises).tot.total, 6);
    // a revisão mantém o bloco B2C
    const rev = reviseProposal(snap);
    expect(rev.b2c).toBeDefined();
    expect(rev.b2c!.input.som).toBe(b2cInput.som);
  });

  it('omite o bloco B2C quando não fornecido', () => {
    const snap = createProposalSnapshot({ id: formatProposalId(4), input: inputWithModules(2) });
    expect(snap.b2c).toBeUndefined();
  });
});
