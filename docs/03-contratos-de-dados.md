# Contratos de dados (§23.4)

A fronteira pública do Pricing Engine. Interfaces estáveis que CRM, portal de parceiros, ferramentas
financeiras e a app comercial consomem (§21). Definidas em
`packages/pricing-engine/src/contracts/types.ts`.

## Entrada — `PricingInput`

```ts
interface PricingInput {
  volume: VolumeParameters;            // base, MAU%, stickiness, tx/MAU
  invoices: InvoiceParameters;         // leitura de NF
  communication: CommunicationParameters; // estratégia + mix + fallback
  complexity: ComplexityParameters;    // integrações, módulos, SLA, custom, AI, migração, horas
  negotiation: NegotiationParameters;  // opção, desconto, prazo, via Minu, expansão, estratégico
  services: ServiceParameters;         // perfis dedicados + horas + premissas de serviço
  campaign: CampaignParameters;        // campanha de marketing (fora do ARR)
  arka?: ArkaParameters;               // evidência comercial (opcional)
}
```

| Bloco | Campos | Unidade/forma |
|---|---|---|
| `volume` | `users`, `mauPct`, `stickiness`, `transactionsPerMau` | usuários; frações [0,1]; nº |
| `invoices` | `enabled`, `participantPct`, `notesPerParticipant` | bool; fração; inteiro |
| `communication` | `perMau`, `strategy`, `fallbackRate`, `customMix` | nº; enum; fração; mix frações |
| `complexity` | `integrations`, `modules`, `slaPoints`, `customizationPoints`, `aiPoints`, `migrationPoints`, `implementationHours` | contagens; pontos; horas |
| `negotiation` | `option`, `extraDiscount`, `term`, `viaMinu`, `expansion`, `strategic` | enum; fração; 12\|24\|36; bools |
| `services` | `profiles[]`, `tablePrice`, `minMargin`, `compCap`, `targetMargin?`, `passthroughPct`, `startMonth`, `hourMinMargin`, `productiveHoursPerMonth`, `hourCost?`, `negotiatedHourPrice?` | R$; frações; mês |
| `campaign` | `enabled`, `objectives[]`, `base?`, `consentPct`, `frequency`, `months`, `mix`, `deliveryRate`, `conversionRate`, `activationRate`, `operationHours`, `markup` | bool; enum[]; nº; frações |
| `arka` | `clientName`, `goLiveDate`, `owner`, `evidenceStage` (1–15), `probability` (0–100) | strings; nº |

**Convenção:** percentuais são sempre frações `[0,1]` na fronteira do motor (a UI converte 0–100 → fração).

## Saída — `PricingResult`

Campos principais (ver o tipo completo para a lista exaustiva):

| Grupo | Campos |
|---|---|
| Versão | `engineVersion`, `premisesVersion`, `premisesHash` |
| Tier | `tierName`, `isCustom` |
| Engajamento | `mau`, `dau` |
| Receita | `platformFeeTable`, `platformFee`, `usage`, `processing`, `core` |
| Custos | `costs` (`CostBreakdown`), `servicesMrr` |
| Setup | `setupNet`, `setupClient` |
| Tributos/Minu | `taxes` (`TaxBreakdown`), `minuConversionFee`, `minuAccountFee` |
| Margens | `technicalMargin`, `netMarginY1`, `netMarginSteady`, `marginStatus` |
| Desconto | `discountAuthority`, `maxDiscount`, `termDiscount` |
| Contrato | `tcvClient`, `tcvBondly`, `contractContribution`, `contractMargin` |
| 1º ano/Minu | `clientYear1`, `minuYear1`, `minuContract` |
| Complexidade | `complexityScore`, `complexityBand` |
| Avisos | `warnings[]` (`PricingWarning`) |

## Contratos auxiliares (módulos)

- **Serviços:** `ProfileResult`, `ServicesResult` (via `services()`).
- **Campanha:** `CampaignResult` (via `campaign()`).
- **B2C:** `B2cInput`, `B2cMonthRow`, `B2cResult` (via `runB2c()`).
- **ARKA:** `ArkaResult`, `EvidenceStage` (via `arkaClassification()`).
- **Snapshot:** `ProposalSnapshot` (via `createProposalSnapshot()`).

## Estabilidade e versão

As interfaces de entrada/saída são o contrato público. Mudanças que quebram o formato exigem bump de
`ENGINE_VERSION` (semver MAJOR). Novos campos opcionais de saída são MINOR. A **tabela de premissas**
tem seu próprio versionamento (`premisesVersion` + `premisesHash`), independente da versão do motor.
