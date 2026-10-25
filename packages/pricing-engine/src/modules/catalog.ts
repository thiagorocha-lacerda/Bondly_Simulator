/**
 * Catálogo de módulos comerciais (prompt §8) — divergência D-M1: o HTML tratava módulos como número.
 * Aqui há os 5 módulos nominais com dependências (§8.2), maturidade técnica (§8.3) e complexidade
 * comercial por quantidade (§8.1). A contagem de módulos selecionados alimenta o score (R-011),
 * preservando retrocompatibilidade.
 */

export type ModuleId = 'points' | 'engagement' | 'roulette' | 'nfReader' | 'benefits';

export type TechnicalMaturity =
  | 'homologado'
  | 'disponivel-config'
  | 'requer-customizacao'
  | 'em-desenvolvimento'
  | 'em-avaliacao'
  | 'indisponivel';

export type CommercialComplexity = 'Baixa' | 'Média' | 'Alta';

export interface ModuleDefinition {
  readonly id: ModuleId;
  readonly name: string;
  readonly maturity: TechnicalMaturity;
  /** Pré-requisitos obrigatórios (devem estar selecionados). */
  readonly requires: readonly ModuleId[];
  /** Integrações opcionais recomendadas (não bloqueiam). */
  readonly recommends: readonly ModuleId[];
}

/** Catálogo padrão. Maturidade é configurável por premissa de negócio; defaults conservadores. */
export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  { id: 'points', name: 'Motor de Pontos', maturity: 'homologado', requires: [], recommends: [] },
  {
    id: 'engagement',
    name: 'Motor de Engajamento (Missões)',
    maturity: 'homologado',
    requires: ['points'], // missões creditam pontos
    recommends: [],
  },
  { id: 'roulette', name: 'Roletas', maturity: 'disponivel-config', requires: ['points'], recommends: ['engagement'] },
  { id: 'nfReader', name: 'Leitor de NF', maturity: 'disponivel-config', requires: [], recommends: ['points'] },
  { id: 'benefits', name: 'Planos de Benefícios', maturity: 'disponivel-config', requires: [], recommends: [] },
];

/** Complexidade comercial pela quantidade de módulos (§8.1). */
export function commercialComplexity(count: number): CommercialComplexity {
  if (count <= 2) return 'Baixa';
  if (count <= 4) return 'Média';
  return 'Alta';
}

export interface DependencyIssue {
  readonly module: ModuleId;
  readonly missing: ModuleId;
  readonly kind: 'required' | 'recommended';
}

/** Valida dependências dos módulos selecionados (§8.2). `required` ausente = bloqueio. */
export function validateDependencies(selected: readonly ModuleId[]): readonly DependencyIssue[] {
  const set = new Set(selected);
  const issues: DependencyIssue[] = [];
  for (const id of selected) {
    const def = MODULE_CATALOG.find((m) => m.id === id);
    if (!def) continue;
    for (const req of def.requires) if (!set.has(req)) issues.push({ module: id, missing: req, kind: 'required' });
    for (const rec of def.recommends)
      if (!set.has(rec)) issues.push({ module: id, missing: rec, kind: 'recommended' });
  }
  return issues;
}

/** Todas as 2^5 = 32 combinações possíveis dos 5 módulos (§19.2). */
export function allModuleCombinations(): readonly (readonly ModuleId[])[] {
  const ids = MODULE_CATALOG.map((m) => m.id);
  const out: ModuleId[][] = [];
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const combo: ModuleId[] = [];
    for (let i = 0; i < ids.length; i++) if (mask & (1 << i)) combo.push(ids[i]!);
    out.push(combo);
  }
  return out;
}
