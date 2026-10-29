# Regras financeiras e premissas (§23.5, §23.6)

Fonte única: `packages/pricing-engine/src/premises/premises.ts` (premissas governadas e versionadas) e
os módulos de `pricing/`, `costs/`, `margins/`, `modules/`. Nenhum valor fixo espalhado pelo código.

## Premissas v15 (governança — §6.1)

Cada premissa carrega **valor, unidade, fonte, data de referência e status**. Versão: `v15`,
`effectiveDate` 2026-10-01, com `hash` de conteúdo imutável.

| Premissa | Valor | Unidade | Status |
|---|---|---|---|
| CleverTap por MAU | 0,0633 | R$/MAU | validada |
| Custo de leitura de NF | 0,12 | R$/nota | validada |
| Infra por transação | 0,1462 | R$/transação | validada |
| Tarifas de comunicação | RCS 0,056 · WhatsApp 0,70 · SMS 0,15 · E-mail 0,15 | R$/comunicação | validada |
| Processing por transação | 0,30 | R$/transação | validada |
| Preço de tabela — dedicado | 35.000 | R$/profissional/mês | validada |
| Hora técnica | 350 | R$/hora | validada |
| Tributos | 11,7% | fração da receita | validada |
| Fee de conversão Minu | 15% | fração do PF (12m) | validada |
| Fee AM/CS Minu | 5% | fração do PF (prazo) | validada |
| Markup de Setup (Minu) | 20% | fração do Setup | validada |
| Margem alvo / piso | 70% / 60% | fração | validada |
| Descontos por prazo | 12→0 · 24→5% · 36→10% | fração sobre PF | validada |
| Corredor de desconto | base 10% · +2,5pp por gatilho · teto 15% | fração | validada |
| **Desconto por tier (editável)** | **3,00%–7,00%** (inclusivo) | fração por tier sobre o PF | **pendente** |
| Markup de campanha | 20% | fração sobre a mídia | validada |
| B2C — fee/mínimo/split | 10% (oficial) · R$2,00 · 50% Minu | — | validada |

Faixas progressivas (`platformFeeBands`, `usageBands`, `tiers`, `complexityBands`, `b2c.antifraudBands`)
reproduzem `PBANDS`/`BANDS`/`TIERS`/`BANDSCX`/Konduto do HTML.

## Regras-chave (prompt §7)

### Platform Fee (progressivo — R-001)
Σ por faixa de usuários: 0,50 ≤25k · 0,485 ≤50k · 0,47 ≤150k · 0,455 ≤250k · 0,445 >250k.
Piso econômico = `cogs/(1−0,60) − usage − proc`. Recomendado/Premium aplicam o markup da banda de
complexidade. Final = escolhido × (1−desc. negociado) × (1−desc. prazo).

### Capacity / recursos dedicados (§7.2 — R-030)
Total Comp de referência **R$ 25.000**, preço-alvo **R$ 35.000**, margem mínima **R$ 5.000**/profissional.
`net = 1 − tributos − repasses`. PMS = `(TC+custos+margemMín)/net`; PCS = tabela quando cobre o PMS,
senão o PMS arredondado; margem = `preço×net − TC − custos`. Avaliado por perfil individualmente.

### Serviços adicionais (§7.3 — R-031)
Hora de referência **R$ 350**, margem mínima **R$ 50/h**. Custo/h = teto de Total Comp ÷ horas
produtivas (160) quando não informado. Horas entram **só no Setup**, nunca na mensalidade.

### Tributação Capacity Fee (§7.1)
**11,7%** sobre a base tributável. Imposto = base × 0,117; líquido = base − imposto. Sem dupla tributação.

### Prazos (§7.4 — R-015)
12/24/36 meses → desconto 0/5/10% **só sobre o Platform Fee**. Não incide em Usage, Processing, Setup,
serviços, comunicação nem campanhas.

### Desconto por tier editável (§3 — Fase 1) — **política PENDENTE de aprovação comercial**
Nova entrada `negotiation.tierDiscount` (fração). Editável por tier dentro de **3,00%–7,00% inclusivo**
(limites em `premises.tierDiscountLimits`, status `pendente`). Fonte única: engine e UI leem o mesmo
limite via `validateTierDiscountPct`.

- **Base elegível:** incide **exclusivamente sobre o Platform Fee (Capacity Fee)** do tier ativo
  (§3.2.5). Não toca Usage, Processing, Setup, serviços, comunicação, campanha ou B2C.
- **Ordem de aplicação (waterfall §3.2.4):** `PF escolhido → ×(1−descontoPorTier) → ×(1−descontoNegociado)
  → ×(1−descontoPrazo) = PF final`. Descontos **sequenciais sobre a base corrente** — não se somam
  linearmente (5%+5%+5% ≠ 15%), evitando incidência dupla/ambígua.
- **Cumulatividade:** convive com o desconto negociado (corredor/alçada R-017) e o desconto por prazo
  (R-015) **sem** substituí-los. A alçada de aprovação do desconto negociado permanece inalterada.
- **Validação dupla (§3.1):** formulário (inline) **e** engine (`resolveTierDiscount` faz clamp de
  fronteira do contrato público §21). Rejeita `NaN`, negativo, string inválida, fora da faixa e mais de
  duas casas decimais. `0`/ausente = sem desconto por tier (não aplicado).
- **Snapshot (§3.2.8):** o valor por tier é salvo em `negotiation.tierDiscount` e congelado no snapshot
  da proposta; `reopenProposal` reproduz o cálculo histórico mesmo que a tabela global mude.
- **Tributação:** o imposto de 11,7% incide sobre o Core **já com o PF descontado** — sem dupla incidência.
- **Status:** a ORDEM e a cumulatividade acima são a política **proposta** por esta implementação. Até a
  validação comercial formal, o limite fica `pendente` (não é premissa aprovada) — conforme §3.2.3.


### Assinaturas B2C (§7.5 — R-060..R-063)
Fee = `max(ticket×fee%, mínimo R$2)`. Gateway, antifraude (faixas Konduto progressivas/integral),
tributos 15%. Margem distribuível dividida 50/50 com a Minu nos meses positivos.

### Comunicação (§7.6 — R-006)
RCS 0,056 · WhatsApp 0,70 · SMS/E-mail 0,15. Fallback = RCS + WhatsApp×taxa. Entra no custo variável.

### TCV (§7.7 — R-025)
`TCV cliente = (core + serviços)×prazo + setup ao cliente + campanha`. Distingue TCV, receita bruta,
receita líquida, custos e margem — todos reconciliados contra o mesmo motor.

## Política de precisão (§5.3)

Aritmética em float64 de precisão plena, sem arredondamentos intermediários; arredondamento só de
apresentação. Mesma ordem de cálculo do HTML → paridade garantida (ver `parity.test.ts`).

## Versionamento (§27.6)

Alterar uma premissa **não** edita a v15: cria-se uma nova versão (ex. v16) e as propostas antigas
permanecem apontando para a v15 via snapshot imutável. `premisesHash` detecta qualquer alteração.
