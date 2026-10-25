# Módulos, dependências, validação técnica e fluxos comerciais (§23.7–§23.9)

## Catálogo de módulos (§8)

`packages/pricing-engine/src/modules/catalog.ts`. Cinco módulos nominais:

| Módulo | id | Maturidade (default) | Pré-requisitos | Recomenda |
|---|---|---|---|---|
| Motor de Pontos | `points` | homologado | — | — |
| Motor de Engajamento (Missões) | `engagement` | homologado | `points` | — |
| Roletas | `roulette` | disponível com config | `points` | `engagement` |
| Leitor de NF | `nfReader` | disponível com config | — | `points` |
| Planos de Benefícios | `benefits` | disponível com config | — | — |

A maturidade é configurável por premissa de negócio; os defaults são conservadores.

### Complexidade comercial por quantidade (§8.1)

| Quantidade | Complexidade |
|---|---|
| 1–2 | Baixa |
| 3–4 | Média |
| 5 | Alta |

A contagem de módulos selecionados alimenta o score de complexidade (R-011), preservando a régua do
HTML (que tratava módulos apenas como número — ver divergência D-M1 em `docs/01`).

### Matriz de dependências (§8.2)

`validateDependencies(selected)` retorna pendências:
- **required** (bloqueio): um módulo selecionado cujo pré-requisito não está selecionado
  (ex.: Engajamento sem Pontos).
- **recommended** (aviso): integração opcional ausente.

As **32 combinações** (2^5) são enumeradas por `allModuleCombinations()` e testadas (§19.2).

### Maturidade técnica (§8.3)

Estados: homologado · disponível com configuração · requer customização · em desenvolvimento ·
em avaliação · indisponível. Alimentam a avaliação técnica e são configuráveis.

## Motor de validação técnica (§9)

A classificação de risco segue a banda de complexidade (0–100) e as pendências de dependência:

| Situação | Classificação |
|---|---|
| Padrão (score < 25), sem pendências | Proposta padronizada |
| Avançado/Complexo, maturidade "requer customização" | Exige avaliação técnica |
| Pendência de dependência `required` | Impedimento técnico comprovado |
| Alta complexidade (Estratégico) | Revisão CEO + Financeiro + plano por fases |

A aprovação está vinculada à configuração efetivamente analisada — não há aprovações fictícias (§9).
O corredor de desconto e a alçada (`discountAuthority`) completam a validação pré-comercial.

## Fluxos comerciais (§11)

Jornada sugerida, implementada no Commercial Workspace:

1. **Identificação** — cliente, oportunidade (Modo rápido).
2. **Produtos** — seleção nominal dos 5 módulos.
3. **Configuração** — volumes, implementação, negociação (Modo avançado).
4. **Integrações/Serviços** — recursos dedicados, horas, campanha, B2C.
5. **Resultados** — dashboard (visão interna/externa), margem, alçada, ARKA.
6. **Revisão** — pré-visualização.
7. **Proposta** — confirmar → gerar PDF (`BONDLY-2027-NNNNNN`).

Modo rápido e modo avançado compartilham o **mesmo** Pricing Engine; migrar entre modos preserva os
dados (estado único em `usePricing`). Salvamento automático em `localStorage` (Cenário A).
