import { describe, it, expect } from 'vitest';
import {
  platformFeeTable,
  usagePerDay,
  monthlyUsage,
  processing,
  mauOf,
  dauOf,
  tierFor,
  complexity,
  technicalMargin,
  marginStatus,
  netMargin,
  discountAuthority,
  communicationUnitCost,
  cogs,
  invoicesFactor,
  CURRENT_PREMISES,
} from '../src/index.js';

const P = CURRENT_PREMISES;

describe('Platform Fee progressivo (R-001)', () => {
  it('cobra cada faixa ao seu preço, como imposto de renda', () => {
    // 50.000 usuários = 25.000×0.50 + 25.000×0.485 = 12.500 + 12.125 = 24.625
    expect(platformFeeTable(50000, P.platformFeeBands.value)).toBeCloseTo(24625, 6);
  });
  it('0 usuários = 0', () => {
    expect(platformFeeTable(0, P.platformFeeBands.value)).toBe(0);
  });
  it('acima do maior patamar usa a última faixa', () => {
    const v = platformFeeTable(300000, P.platformFeeBands.value);
    // 25k×.5 + 25k×.485 + 100k×.47 + 100k×.455 + 50k×.445
    expect(v).toBeCloseTo(12500 + 12125 + 47000 + 45500 + 22250, 6);
  });
});

describe('Usage e Processing (R-003/R-004)', () => {
  it('usagePerDay progressivo', () => {
    // DAU 3000 → 3000×0.08 = 240
    expect(usagePerDay(3000, P.usageBands.value)).toBeCloseTo(240, 6);
  });
  it('monthlyUsage = perDay × 30', () => {
    expect(monthlyUsage(3000, P.usageBands.value)).toBeCloseTo(240 * 30, 6);
  });
  it('processing = mau × tx × 0.30', () => {
    expect(processing(20000, 1, P.processingPerTransaction.value)).toBeCloseTo(6000, 6);
  });
});

describe('Engajamento e tier (R-002/R-008/R-009)', () => {
  it('MAU e DAU', () => {
    expect(mauOf(50000, 0.4)).toBe(20000);
    expect(dauOf(20000, 0.15)).toBe(3000);
  });
  it('tierFor seleciona o menor tier cujo teto cobre', () => {
    expect(tierFor(50000, P.tiers.value).name).toBe('Growth');
    expect(tierFor(26000, P.tiers.value).name).toBe('Growth');
    expect(tierFor(25000, P.tiers.value).name).toBe('Starter');
    expect(tierFor(500000, P.tiers.value).name).toBe('Enterprise+');
  });
});

describe('Complexidade (R-011/R-012)', () => {
  it('score padrão', () => {
    const r = complexity(
      { integrations: 1, modules: 2, slaPoints: 0, customizationPoints: 0, aiPoints: 0, migrationPoints: 0, implementationHours: 0 },
      P.complexityBands.value,
    );
    // integ 1/5×20=4 + mods (1/5)×15=3 = 7 → Padrão
    expect(r.score).toBeCloseTo(7, 6);
    expect(r.band.name).toBe('Padrão');
  });
  it('score máximo → Estratégico', () => {
    const r = complexity(
      { integrations: 10, modules: 10, slaPoints: 15, customizationPoints: 20, aiPoints: 15, migrationPoints: 15, implementationHours: 0 },
      P.complexityBands.value,
    );
    expect(r.score).toBeCloseTo(100, 6);
    expect(r.band.name).toContain('Estratégico');
  });
  it('blindagem: pontos fora da faixa são clampados ao teto; score nunca passa de 100', () => {
    const r = complexity(
      // consumidor externo (§21) manda valores arbitrários acima do máximo
      { integrations: 99, modules: 99, slaPoints: 999, customizationPoints: 999, aiPoints: 999, migrationPoints: 999, implementationHours: 0 },
      P.complexityBands.value,
    );
    expect(r.score).toBeCloseTo(100, 6); // satura em 100, não explode
    expect(r.band.name).toContain('Estratégico');
    for (const part of r.parts) expect(part.value).toBeLessThanOrEqual(part.max + 1e-9);
  });
  it('blindagem: pontos negativos/NaN são tratados como 0', () => {
    const r = complexity(
      { integrations: -5, modules: 0, slaPoints: -10, customizationPoints: Number.NaN, aiPoints: 0, migrationPoints: 0, implementationHours: 0 },
      P.complexityBands.value,
    );
    expect(r.score).toBe(0);
    for (const part of r.parts) expect(part.value).toBeGreaterThanOrEqual(0);
  });
});

describe('Comunicação e COGS (R-005/R-006)', () => {
  const t = P.communicationTariffs.value;
  it('fallback = rcs + wa×fb', () => {
    expect(communicationUnitCost('fallback', 0.4, { sms: 0, email: 0, rcs: 1, wa: 0.4 }, t)).toBeCloseTo(0.056 + 0.7 * 0.4, 9);
  });
  it('none = 0; both = rcs+wa', () => {
    expect(communicationUnitCost('none', 0, { sms: 0, email: 0, rcs: 0, wa: 0 }, t)).toBe(0);
    expect(communicationUnitCost('both', 0, { sms: 0, email: 0, rcs: 0, wa: 0 }, t)).toBeCloseTo(0.756, 9);
  });
  it('invoicesFactor arredonda notas e limita pct', () => {
    expect(invoicesFactor(true, 0.1, 1)).toBeCloseTo(0.1, 9);
    expect(invoicesFactor(true, 1.5, 2.6)).toBeCloseTo(3, 9); // pct clamped 1, qty round 3
    expect(invoicesFactor(false, 0.5, 2)).toBe(0);
  });
  it('cogs soma as quatro parcelas', () => {
    const c = cogs({
      mau: 20000,
      transactionsPerMau: 1,
      invoicesFactor: 0.1,
      communicationUnit: 0.336,
      communicationsPerMau: 1,
      cleverTapPerMau: 0.0633,
      invoiceReadCost: 0.12,
      infraPerTransaction: 0.1462,
    });
    expect(c.total).toBeCloseTo(20000 * 0.0633 + 20000 * 0.1 * 0.12 + 20000 * 0.1462 + 20000 * 0.336, 6);
  });
});

describe('Margens (R-018/R-019/R-024)', () => {
  it('margem técnica', () => {
    expect(technicalMargin(100, 30)).toBeCloseTo(0.7, 9);
    expect(technicalMargin(0, 10)).toBe(0);
  });
  it('status pelos guardrails', () => {
    const common = { mau: 20000, users: 50000, target: 0.7, floor: 0.6, maxTierUsers: 400000 };
    expect(marginStatus({ margin: 0.72, ...common })).toBe('SAUDÁVEL');
    expect(marginStatus({ margin: 0.65, ...common })).toBe('REVISAR');
    expect(marginStatus({ margin: 0.5, ...common })).toBe('REPRECIFICAR');
    expect(marginStatus({ margin: 0.72, ...common, mau: 0 })).toBe('INCOMPLETO');
    expect(marginStatus({ margin: 0.72, ...common, users: 500000 })).toBe('CUSTOMIZADO');
  });
  it('margem líquida Y1 inclui feeConv, regime não', () => {
    const r = netMargin({ core: 100, cogs: 30, taxRate: 0.117, conversionFee: 5, accountFee: 2 });
    expect(r.year1).toBeCloseTo((100 - 30 - 11.7 - 5 - 2) / 100, 9);
    expect(r.steady).toBeCloseTo((100 - 30 - 11.7 - 2) / 100, 9);
  });
});

describe('Corredor e alçada (R-017)', () => {
  it('corredor base 10%, +2.5pp por gatilho, teto 15%', () => {
    expect(discountAuthority({ requestedDiscount: 0, expansion: false, strategic: false, table: P }).maxDiscount).toBeCloseTo(0.1, 9);
    expect(discountAuthority({ requestedDiscount: 0, expansion: true, strategic: true, table: P }).maxDiscount).toBeCloseTo(0.15, 9);
  });
  it('alçada por faixa', () => {
    expect(discountAuthority({ requestedDiscount: 0.03, expansion: false, strategic: false, table: P }).authority).toBe('Comercial');
    expect(discountAuthority({ requestedDiscount: 0.07, expansion: false, strategic: false, table: P }).authority).toBe('Head / Diretor');
    expect(discountAuthority({ requestedDiscount: 0.12, expansion: true, strategic: true, table: P }).authority).toBe('CEO + Financeiro');
    expect(discountAuthority({ requestedDiscount: 0.2, expansion: false, strategic: false, table: P }).severity).toBe('error');
  });
});

describe('Premissas de serviço explícitas (governança — hourCost não é mais implícito)', () => {
  it('a base do custo/hora vive na tabela versionada, com os valores do legado', () => {
    expect(P.serviceCompCap.value).toBe(25000);
    expect(P.serviceProductiveHours.value).toBe(160);
    expect(P.serviceMinMargin.value).toBe(5000);
    expect(P.serviceHourMinMargin.value).toBe(50);
    // hourCost default do legado = cap/horas = 25000/160 = 156.25, agora derivado de premissas
    expect(P.serviceCompCap.value / P.serviceProductiveHours.value).toBeCloseTo(156.25, 9);
  });
});
