# Arquitetura e roadmap (§23.1–§23.3, §23.16)

## Arquitetura geral (§23.1)

Monorepo npm workspaces, duas camadas com separação obrigatória (§2):

```
bondly-commercial-platform/
├── packages/pricing-engine/      CAMADA 1 — motor financeiro (TS puro, sem UI)
├── apps/commercial-workspace/    CAMADA 2 — interface (React + Vite)
├── packages/{shared-types,business-rules,ui}/  reservados para evolução
├── docs/                         documentação
└── render.yaml                   deploy Render (Static Site, SPA)
```

Regra de ouro: **toda regra financeira existe numa única fonte** (o Pricing Engine). O Commercial
Workspace consome os resultados do motor e **não reproduz fórmulas** (§20/§24 Diretriz Final).

## Arquitetura do Pricing Engine (§23.2)

- Funções puras, determinísticas, sem DOM. Entrada `PricingInput` → saída `PricingResult`.
- Organização: `contracts/` (tipos), `premises/` (premissas versionadas), `calculations/`
  (orquestrador + primitivas), `pricing/`, `costs/`, `margins/`, `validations/`, `modules/`
  (catálogo, campanha, ARKA, B2C), `scenarios/`, `versioning/`.
- Reutilizável por CRM, portal de parceiros, ferramentas financeiras (§21): contratos estáveis,
  sem infraestrutura distribuída.

## Arquitetura do Commercial Workspace (§23.3)

- React 18 + TypeScript + Vite. Estado central em `usePricing` (entrada + resultado memoizado).
- Resolve o motor pela **fonte TS** (alias Vite + tsconfig paths) — um motor só, tipos vivos.
- Componentes: `Fields` (campos reutilizáveis), `QuickMode`/`AdvancedMode`, `ServicesPanel`,
  `CampaignPanel`, `B2cPanel`, `ResultsDashboard` (visão interna/externa), `PreviewModal` (fluxo PDF).
- Persistência `localStorage` (Cenário A); tema claro/escuro; PDF via jsPDF lazy-loaded. Deploy como Static Site na Render (`render.yaml`).

## Roadmap de evolução (§23.16)

### Curto prazo
- **Deploy na Render** (§27.9) — assim que houver acesso à conta/repositório.
- **Exportar/importar propostas** em JSON (portabilidade no Cenário A).
- Expor matrizes B2C adicionais (fees, sensibilidade a ticket, ponto de equilíbrio) que o motor já
  calcula via `runB2c`.

### Médio prazo — Cenário B (operação compartilhada, §27.5)
- Backend + banco durável para **histórico compartilhado** e **unicidade global** de propostas.
- **Autenticação e autorização por perfil**; proteção de acesso à app em produção (dados confidenciais).
- Trilha de auditoria; aprovação institucional das propostas (workflow de alçada).
- Integração do motor com **CRM** e **sistemas de aprovação** (contratos já prontos, §21).

### Governança financeira contínua
- Pipeline de **nova versão de premissas** (v16, v17…) com propostas antigas preservadas por snapshot.
- Painel de governança de premissas (status validada/pendente/divergente por item).

### Qualidade
- Testes de regressão visual (light/dark, responsividade) e de acessibilidade automatizada.
- Code-splitting adicional por rota quando a app crescer.
