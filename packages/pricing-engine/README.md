# @bondly/pricing-engine

Motor financeiro **independente de React/DOM** (prompt §5) — fonte única de verdade das regras
comerciais da Bondly. Reproduz bit-a-bit o `calc()`/`b2cRun()`/`svCalc()`/`campaign()` do simulador
HTML V1.0, com contratos tipados, premissas versionadas e snapshots imutáveis por proposta.

## Propriedades (prompt §5)

- **Independente**: zero dependência de DOM, React, hooks, CSS ou libs de UI.
- **Determinístico**: mesma entrada + mesma versão de premissas ⇒ mesma saída (funções puras).
- **Modular / testável / reutilizável / tipado / versionável** (§5).
- **Precisão (§5.3)**: aritmética em float64 de precisão plena, **sem arredondamentos intermediários**;
  o arredondamento é só de apresentação (`roundCurrency`). Mesma ordem de cálculo do HTML para garantir paridade.

## API pública

```ts
import { calculate, CURRENT_PREMISES, createProposalSnapshot, formatProposalId } from '@bondly/pricing-engine';

const result = calculate(input);                 // PricingResult completo
const snap = createProposalSnapshot({ id: formatProposalId(1), input }); // snapshot imutável
```

Entrada (`PricingInput`) e saída (`PricingResult`) em `src/contracts/types.ts`. Blocos individuais
(`platformFeeTable`, `resolvePlatformFee`, `complexity`, `services`, `minuFees`, `campaign`, `runB2c`,
`arkaClassification`, `discountAuthority`, `defaultScenarios`, …) exportados para reuso granular (§21).

## Estrutura

```
src/
├── contracts/types.ts        Contratos de dados (entrada/saída) — fronteira pública
├── premises/premises.ts      Premissas GOVERNADAS e VERSIONADAS (§6, §27.6)
├── calculations/
│   ├── calculate.ts          Orquestrador calculate() (≡ calc())
│   ├── bands.ts              Primitivas de faixas progressivas (§5.2)
│   └── money.ts              Política monetária/precisão (§5.3)
├── pricing/                  platformFee · usage · complexity · setup · services
├── costs/                    communication · cogs
├── margins/margins.ts        margem técnica, guardrails, margem líquida
├── validations/              discountAuthority (corredor + alçada)
├── modules/                  catalog (5 módulos + deps/maturidade) · campaign · arka · b2c
├── scenarios/scenarios.ts    comparação conservador/base/otimista (§13)
└── versioning/proposal.ts    snapshot imutável + revisões (§27.6 + req. complementar)
```

## Versionamento financeiro (§27.6 + requisito complementar)

Cada proposta grava um **snapshot imutável**: `engineVersion`, `premisesVersion`, `premisesHash`,
cópia congelada da tabela de premissas, `input`, `result`, `id` (`BONDLY-2027-NNNNNN`) e data.

- `createProposalSnapshot()` — calcula contra a tabela congelada (não a global).
- `reopenProposal()` — recalcula contra as premissas congeladas e verifica reprodutibilidade + integridade do hash.
- `reviseProposal()` — gera nova revisão com premissas atuais, **preservando o snapshot anterior**.

Alterar preços/tributos/margens globais **não** altera propostas já emitidas.

## Testes

```
npm run test        # vitest run — 40 testes
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
```

Cobertura por camada (§19/§20):
- **Paridade (§22)** — `parity.test.ts`: 73 cenários comparados contra a reimplementação fiel do
  `calc()` legado (`legacyReference.ts`), ~22 campos financeiros cada. Prova "resultados coincidem".
- **Unidades** — `units.test.ts`: fórmulas, tributos, custos, margens, descontos, comunicação.
- **Módulos** — `modules.test.ts`: as **32 combinações** dos 5 módulos (§19.2), dependências,
  campanha (funil 100k→70k→24.5k→3.675k), ARKA, versionamento/snapshot.
- **B2C + cenários** — `b2c-scenarios.test.ts`.

## Regras financeiras preservadas (ver `docs/01-auditoria-html-original.md`)

Platform Fee progressivo · DAU Usage · Processing · COGS (CleverTap/infra/NF/comunicação) ·
complexidade 0–100 e bandas · desconto por prazo (só PF) · corredor/alçada · margem técnica 70/60 ·
Capacity/recursos dedicados (R$25k/R$35k/R$5k) · horas R$350 · TCV · fees Minu (15%+5%+20%) ·
tributos 11,7% · campanhas (markup 20%) · B2C (antifraude Konduto, churn, fees) · ARKA H1/H2/H3.
