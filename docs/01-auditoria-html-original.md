# Auditoria do Simulador HTML original — Bondly 2027

> Documento de auditoria (prompt §4). Extrai **integralmente** as regras de negócio, fórmulas,
> tributos, custos, margens, repasses, descontos, módulos e fluxos do arquivo
> `Bondly_2027_Simulador_Comercial_V1.0.html`. É a **referência funcional e financeira** da nova
> plataforma. Toda regra marcada `Validada` é reproduzida bit-a-bit pelo Pricing Engine; toda regra
> marcada `Divergente` traz a correção justificada.
>
> **Status da aplicação no HTML:** fonte única, ~1.400 linhas, motor financeiro embutido em JS puro
> (`<script>`), sem separação motor/UI. Toda a lógica vive em `calc()`, `campaign()`, `svCalc()`,
> `complexity()`, `b2cRun()` e helpers. jsPDF 2.5.2 embutido para o PDF.

---

## 4.1 Auditoria funcional — telas, campos e fluxos

| Área | Função | Classificação |
|---|---|---|
| **O cliente** | base elegível, MAU %, stickiness, tx/MAU, leitura de NF (on/off, % participantes, notas/part.), comunicações/MAU, estratégia de comunicação (8 opções + mix custom + fallback) | Preservar |
| **A implementação** | integrações, módulos, SLA, customização, AI, migração → score de complexidade; horas de implantação; estratégia de conta (expansão/estratégico) | Preservar |
| **A negociação** | opção comercial (piso/recomendado/premium), desconto extra, prazo (12/24/36), recursos dedicados (qtd), venda via Minu | Preservar |
| **Campanhas de marketing** | objetivos, base/consentimento, frequência, meses, mix de canais, taxas de entrega/conversão/ativação, horas de operação, markup, LGPD | Preservar (serviço à parte, fora do ARR) |
| **Evidência ARKA** | cliente nomeado, go-live, owner, evidência comercial (15 estágios), probabilidade, briefing | Preservar |
| **Resultados / dashboard** | tier, R$/usuário, cliente paga Y1, TCV, ARR, Minu Y1, breakdown, régua de margem, alçada | Preservar; **melhorar** separação visão interna/externa |
| **Por que esse preço** | MAU/DAU, faixas de usage, COGS aberto | Preservar |
| **Tabela v15** | tiers + preço por volume (exemplos) | Preservar |
| **Serviços** | recursos dedicados por perfil (5 perfis), 4 preços (tabela/PCS/PMS/negociado), horas, sensibilidades | Preservar |
| **Assinaturas B2C** | módulo H3 completo: fee, SOM, conversão, ticket, churn, curva, antifraude Konduto, matrizes | Preservar |
| **Resumo Pipeline** | texto copiável + reset + tema claro/escuro + persistência localStorage | Preservar; **melhorar** (snapshot imutável) |
| **PDF** | jsPDF embutido (não há botão visível de gerar PDF no HTML auditado — jsPDF presente mas fluxo de PDF ausente/incompleto) | **Corrigir/Substituir** — novo gerador com paridade Engine=Dashboard=PDF |

**Observação funcional relevante (Divergente D-F1):** o prompt (§16) exige o fluxo
`PRÉ-VISUALIZAR → CONFERIR → CONFIRMAR → GERAR PDF` e identificador único `BONDLY-2027-NNNNNN`.
O HTML traz a lib jsPDF mas **não** expõe esse fluxo nem o identificador. → implementar do zero na nova app.

---

## 4.2 Auditoria financeira — regras extraídas

Constantes globais (`const C`):
`clever=0.0633 · nf=0.12 · infra=0.1462 · proc=0.30 · hour=350 · ded=35000 · tax=0.117 ·
feeConv=0.15 · feeAM=0.05 · setupMk=0.20 · target=0.70 · floor=0.60 ·
rcs=0.056 · wa=0.70 · sms=0.15 · email=0.15 · campMk=0.20 · termDisc={12:0,24:0.05,36:0.10}`

### Matriz de rastreabilidade (Regra original → auditada → Pricing Engine → Teste)

| ID | Nome | Origem (HTML) | Entradas | Fórmula | Saída | Deps | Status | Implementação | Teste |
|---|---|---|---|---|---|---|---|---|---|
| R-001 | Platform Fee de tabela (progressivo) | `PBANDS`,`pfBand()` | usuários | Σ por faixa: 0.50≤25k·0.485≤50k·0.47≤150k·0.455≤250k·0.445>250k | pfTable | — | Validada | `pricing/platformFee.ts` | `platformFee.test` |
| R-002 | Tier | `TIERS`,`tierFor()` | usuários | menor tier cujo teto ≥ usuários; >400k = customizado | tier | — | Validada | `modules/tiers.ts` | `tiers.test` |
| R-003 | DAU Usage | `BANDS`,`usagePerDay()` | DAU | Σ faixas diárias (0.08/0.06/0.045/0.035/0.025) × 30 | usage/mês | R-010 | Validada | `pricing/usage.ts` | `usage.test` |
| R-004 | Processing | `calc()` | MAU, tx | MAU × tx × 0.30 | proc/mês | — | Validada | `pricing/processing.ts` | `processing.test` |
| R-005 | COGS (custo variável) | `cogsFor()` | MAU, tx, nf, comm, cpm | MAU×0.0633 + MAU×nf×0.12 + MAU×tx×0.1462 + MAU×cpm×comm | cogs/mês | R-006 | Validada | `costs/cogs.ts` | `cogs.test` |
| R-006 | Custo unitário de comunicação | `commUnit()` | estratégia, fb, mix | rcs/wa/sms/email/both(rcs+wa)/fallback(rcs+wa×fb)/custom(Σ mix×tarifa)/none=0 | R$/comunicação | — | Validada | `costs/communication.ts` | `communication.test` |
| R-007 | NF estimadas | `calc()` (nf) | MAU, nfPct, nfQty, on | on ? nfPct×nfQty : 0; notas/mês = MAU×nf | nf, notas | — | Validada | `costs/invoices.ts` | `invoices.test` |
| R-008 | MAU | `calc()` | usuários, mau% | usuários × mau% | MAU | — | Validada | `calculations/engagement.ts` | `engagement.test` |
| R-009 | DAU | `calc()` | MAU, stick% | MAU × stick% | DAU | R-008 | Validada | `calculations/engagement.ts` | `engagement.test` |
| R-010 | — (reservado: DAU→usage) | — | — | — | — | — | — | — | — |
| R-011 | Score de complexidade | `complexity()`,`BANDSCX` | integ, mods, sla, custom, ai, migr | integ:min(x,5)/5×20 · mods:min(max(x-1,0),5)/5×15 · sla · custom · ai · migr (soma 0–100) | score | — | Validada | `pricing/complexity.ts` | `complexity.test` |
| R-012 | Banda de complexidade | `BANDSCX` | score | <25 Padrão(×1.0,mk0,mkp.10)·<50 Avançado(×1.15,.075,.15)·<75 Complexo(×1.30,.15,.25)·else Estratégico(×1.50,.25,.35) | banda setup/markup | R-011 | Validada | `pricing/complexity.ts` | `complexity.test` |
| R-013 | Platform Fee piso (econômico) | `calc()` pfPiso | pfTable, cogs0, usage0, proc0 | max(pfTable×0.9, cogs0/(1-0.60) − usage0 − proc0) | pfPiso | R-005 | Validada | `pricing/platformFee.ts` | `platformFee.test` |
| R-014 | PF recomendado / premium | `calc()` pfRec/pfPrem | pfTable, banda | pfRec=max(pfPiso, pfTable×(1+mk)); pfPrem=max(pfRec, pfTable×(1+mkp)) | pfRec, pfPrem | R-012,R-013 | Validada | `pricing/platformFee.ts` | `platformFee.test` |
| R-015 | Desconto por prazo | `C.termDisc` | prazo | 12→0 · 24→5% · 36→10% (só sobre PF) | tdisc | — | Validada | `pricing/discounts.ts` | `discounts.test` |
| R-016 | PF final | `calc()` pf | pfOpt, disc, tdisc | pfOpt × (1−disc) × (1−tdisc) | pf | R-014,R-015 | Validada | `pricing/platformFee.ts` | `platformFee.test` |
| R-017 | Corredor de desconto / alçada | `calc()` maxDisc | exp, key, disc | maxDisc=min(0.15, 0.10 + exp?0.025 + key?0.025); alçada por faixa 5/10/15% | alçada | — | Validada | `validations/discountAuthority.ts` | `discountAuthority.test` |
| R-018 | Margem técnica | `calc()` margin | core, cogs | (core − cogs) / core | margin | R-005 | Validada | `margins/technicalMargin.ts` | `margins.test` |
| R-019 | Guardrails de margem | `C.target/floor` | margin | ≥70% SAUDÁVEL · ≥60% REVISAR · <60% REPRECIFICAR | status | R-018 | Validada | `margins/guardrails.ts` | `margins.test` |
| R-020 | Core MRR | `calc()` core | pf, usage, proc | pf + usage + proc | core | R-016,R-003,R-004 | Validada | `calculations/core.ts` | `core.test` |
| R-021 | Setup | `calc()` setup* | tier.setup, banda, opção, implh, hprice | setupRec=tier.setup×banda.setup; setupTable por opção (piso×.9/rec/prem×1.15); setupNet=setupTable+implh×hprice; setupClient=setupNet×(via?1.2:1) | setupNet/Client | R-012,R-050 | Validada | `pricing/setup.ts` | `setup.test` |
| R-022 | Tributos | `C.tax` | core, services | (core+services) × 0.117 | tax | — | Validada | `taxes/taxes.ts` | `taxes.test` |
| R-023 | Fees da Minu | `calc()` | via, pf | feeConv=via?pf×0.15:0 (12m); feeAM=via?pf×0.05:0 (prazo); setup markup 20% | fees | R-016 | Validada | `pricing/minuFees.ts` | `minuFees.test` |
| R-024 | Margem líquida Y1/regime | `calc()` net* | core, cogs, tax, fees | Y1:(core−cogs−core×tax−feeConv−feeAM)/core; regime sem feeConv | netY1/netSteady | R-023 | Validada | `margins/netMargin.ts` | `margins.test` |
| R-025 | TCV ao cliente / Bondly | `calc()` tcv* | core, services, prazo, setup, camp | cliente=(core+services)×prazo+setupClient+camp.rev; Bondly usa setupNet | tcv | R-020,R-021 | Validada | `calculations/tcv.ts` | `tcv.test` |
| R-026 | Economia do contrato | `calc()` k* | acumulados | kRev + setupNet − kCogs − kTax − kFees + camp.contrib − setupNet×tax − sv.cost×prazo − implh×hcost | kContrib, kMargin | R-023,R-030 | Validada | `calculations/contract.ts` | `contract.test` |
| R-027 | Minu no contrato | `calc()` minuContract | via, fees, setup | via?(feeConv×min(12,prazo)+feeAM×prazo+setupNet×0.20):0 | minuContract | R-023 | Validada | `pricing/minuFees.ts` | `minuFees.test` |
| R-028 | Cliente paga Y1 / Minu Y1 | `calc()` | core, services, setupClient, camp | clientY1=(core+services)×12+setupClient+camp.revY1; minuY1=via?(feeConv+feeAM)×12+setupNet×0.20:0 | clientY1, minuY1 | R-023 | Validada | `calculations/firstYear.ts` | `firstYear.test` |
| R-030 | Serviços — recursos dedicados (5 perfis) | `svCalc()` | PT, min, cap, target, rep, perfis | PMS=(tc+dc+mmin)/net; PCS=max(pt≥pms?pt:ceil(pms,100), target→ceil((tc+dc+tgt)/net,100)); margem=price×net−tc−dc; net=1−tax−rep | prof[], mrr, marg | R-022 | Validada | `pricing/services.ts` | `services.test` |
| R-031 | Serviços — horas adicionais | `svCalc()` h* | hcost, hmin, href, hprod | hcost=cap/hprod; hpms=(hcost+hmin)/net; hpcs=href≥hpms?href:ceil(hpms); margem/hora | hprice, hm | R-030 | Validada | `pricing/services.ts` | `services.test` |
| R-040 | Campanha de marketing | `campaign()` | base, consent, freq, meses, mix, entrega, conv, ativ, horas, markup | sends/media/deliv por canal; rev=media×(1+mk)+horas×350; contrib=rev−media−rev×tax; funil deliv→acq→act; CAC | camp.* | R-006 | Validada | `modules/campaign.ts` | `campaign.test` |
| R-050 | ARKA — classificação H1/H2/H3 | `render()` EVID | evidência(15), cliente, go-live, owner, prob, volumetria | H2 se evr≥8 (proposta enviada) + todos os checks; H1=contrato vigente; senão H3 | classe ARKA | — | Validada | `modules/arka.ts` | `arka.test` |
| R-060 | B2C — fee por assinatura | `b2cRun()` | ticket, fee%, minfee | max(ticket×fee%, minfee) | fee unit. | — | Validada | `modules/b2c.ts` | `b2c.test` |
| R-061 | B2C — curva de aquisição | `b2cRun()` | SOM, conv, churn, pesos | K escala pesos p/ meta dez descontando churn; end=start−canc+novos | base mensal | — | Validada | `modules/b2c.ts` | `b2c.test` |
| R-062 | B2C — antifraude Konduto | `b2cAF()`,`B2C.bands` | volume, método, escopo, valida | progressiva/integral por faixas; max(min mensal, base) + valida×0.18; setup jul | af/mês | — | Validada | `modules/b2c.ts` | `b2c.test` |
| R-063 | B2C — margem distribuível / split Minu | `b2cRun()` | rev, gw, af, tax, minu% | margin=rev−gw−af−tax−add; minu=max(0,margin)×minu%; bondly=margin−minu | resultado | R-060,R-062 | Validada | `modules/b2c.ts` | `b2c.test` |

---

## 4.3 Catálogo de módulos (prompt §8) vs. HTML

O prompt define **5 módulos comerciais nominais**: Motor de Pontos · Motor de Engajamento (Missões) ·
Roletas · Leitor de NF · Planos de Benefícios, com complexidade por quantidade (1–2 Baixa, 3–4 Média, 5 Alta)
e matriz de dependências/maturidade técnica.

**Divergência D-M1 (Substituir/Melhorar):** o HTML trata "módulos" apenas como um **número** (`mods`, input
numérico 1–12) que alimenta o score de complexidade (R-011). Não há seleção nominal, dependências nem
maturidade. → A nova plataforma implementa o **catálogo nominal dos 5 módulos** com matriz de dependências e
maturidade (prompt §8.2/§8.3), preservando a regra de complexidade por quantidade e mantendo retrocompat com o
cálculo de score (a contagem de módulos selecionados alimenta R-011). As **32 combinações** (2^5) são testadas (§19.2).

---

## 4.4 Divergências consolidadas (prompt §22/§35)

| ID | Divergência | Decisão | Justificativa |
|---|---|---|---|
| D-F1 | HTML não expõe fluxo de PDF nem identificador único | Substituir | Novo gerador com paridade Engine=Dashboard=PDF e `BONDLY-2027-NNNNNN` (§15/§16) |
| D-M1 | Módulos = número, sem catálogo nominal/dependências/maturidade | Melhorar | Catálogo dos 5 módulos + matriz; contagem continua alimentando o score |
| D-A1 | Premissas espalhadas em `const C` sem governança | Melhorar | Centralizar com nome/valor/unidade/fonte/data/versão + snapshot imutável (§6/§27.6) |
| D-A2 | Cálculos acoplados ao DOM (`$()`, `render()`) | Substituir | Motor TS puro, determinístico, sem DOM (§5) |
| D-P1 | Sem versionamento financeiro — alterar premissa muda propostas antigas | Corrigir | Snapshot imutável por proposta + versão do motor (requisito complementar) |

**Para entradas equivalentes, os resultados financeiros devem coincidir** com o HTML original, salvo as
correções acima — garantido pelo teste de paridade (`parity.test`) que reimplementa o `calc()` legado e
compara contra o Pricing Engine em um grid de cenários.
