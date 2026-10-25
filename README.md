# Bondly Commercial Platform

Nova plataforma comercial Bondly 2027 — **Pricing Engine independente** + **Commercial Workspace**,
construída do zero com o simulador HTML V1.0 como referência funcional e financeira.

```
bondly-commercial-platform/
├── packages/pricing-engine/      motor financeiro TS puro (fonte única de verdade) — 40 testes
├── apps/commercial-workspace/    app React + Vite consumindo o motor (Vercel-ready)
├── docs/                         auditoria, execução/deploy, checklist
└── vercel.json                   configuração de deploy (SPA fallback)
```

## Arquitetura

Duas camadas com separação obrigatória (prompt §2):

- **Pricing Engine** (`@bondly/pricing-engine`) — regras, precificação, tributos, margens, módulos,
  validações, cenários, versionamento. **Zero** dependência de UI. Reproduz o `calc()` legado
  (paridade provada em teste). Ver `packages/pricing-engine/README.md`.
- **Commercial Workspace** (`@bondly/commercial-workspace`) — interface, jornada comercial, modos
  rápido/avançado, dashboard (visão interna/externa), fluxo pré-visualizar→confirmar→PDF, Design
  System light/dark. **Não contém regra financeira**: todo cálculo passa pelo motor.

## Status das entregas (prompt §24)

| # | Entregável | Status |
|---|---|---|
| 1 | Pricing Engine independente, documentado e testado | ✅ |
| 2 | Commercial Workspace funcional | ✅ |
| 3 | Design System (tokens, light/dark, WCAG AA) | ✅ |
| 4 | Gerador de PDF (jsPDF) | ✅ |
| 5 | Testes automatizados (unidade, módulos, paridade) | ✅ 40 testes |
| 6 | Documentação | ✅ auditoria + execução/deploy + READMEs |
| 7 | Relatório de auditoria (comparação com o HTML) | ✅ `docs/01` |
| 8 | Pacote final executável | ✅ monorepo buildável |
| 9 | Deploy na Vercel | ⏳ **pronto, não executado** — requer acesso à conta (§27.9) |

Ver `docs/02-execucao-e-deploy.md` para rodar, buildar e publicar.

## Início rápido

```bash
npm install
npm run test                                              # motor: 40 testes
npm run dev --workspace @bondly/commercial-workspace      # http://127.0.0.1:5173
npm run build --workspace @bondly/commercial-workspace    # dist/ Vercel-ready
```
