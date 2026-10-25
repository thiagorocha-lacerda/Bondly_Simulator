# Design System, geração de PDF e persistência (§23.10–§23.12)

## Design System (§17)

`apps/commercial-workspace/src/styles/tokens.css` — tokens em **3 camadas**:

1. **Cores-base** — paleta oficial Bondly (navy `#2a2470`, brand amber `#ffc81e`, sand, inks, estados).
2. **Semânticos** — `--bg-*`, `--surface*`, `--text-*`, `--border*`, `--brand`, estados
   (`--success/warning/error/info` + `*-soft`), `--focus-ring`. Trocam por tema.
3. **Componentes** — classes em `global.css` (`.panel`, `.field`, `.toggle`, `.tier`, `.big`,
   `.status`, `.note`, `.stepper`, `.cta`, `.pdfmodal`, tabela `.bd`).

### Temas
- **Light** e **Dark** via `:root[data-theme="..."]`, persistidos em `localStorage` (`useTheme`).
- Todo par cor/fundo é definido em conjunto (nunca cor fixa solta).

### Acessibilidade (WCAG 2.2 AA)
- `:focus-visible` com anel de 3px em todos os controles.
- Contraste dos tokens semânticos calibrado para AA nos dois temas.
- `@media (prefers-reduced-motion: reduce)` desliga transições.
- Inputs com `<label>` associado; toggles com `role="group"` + `aria-pressed`; stepper com
  `role="tablist"`/`aria-current`; modal com `role="dialog"` + `aria-modal`.

### Tipografia
Montserrat (400/600/700/800) para texto; Anton para títulos de marca. Fontes embutidas no HTML legado;
no workspace, declaradas como família com fallback de sistema.

## Geração de PDF (§16)

`apps/commercial-workspace/src/services/pdf.ts` — `generateProposalPdf(snapshot)`.

- Biblioteca **jsPDF**, carregada via `import()` dinâmico (code-splitting: fora do bundle principal,
  baixada só ao gerar o PDF).
- Consome **exclusivamente** o `ProposalSnapshot` do motor — nenhum valor recalculado
  (paridade Engine = Dashboard = Pré-visualização = PDF, §20).
- **Visão comercial externa:** o PDF não expõe custos, margens nem fees internos (§12/§16).
- Estrutura: cabeçalho de marca · identificador `BONDLY-2027-NNNNNN` + revisão + data · cliente/escopo ·
  condições comerciais (Setup, mensal, TCV, 1º ano) · composição da mensalidade · rodapé de
  reprodutibilidade (versão do motor + hash de premissas).
- Fluxo: **PRÉ-VISUALIZAR → CONFERIR → CONFIRMAR → GERAR PDF**. Confirmar congela o snapshot;
  alterar a proposta depois gera nova revisão.

## Persistência (§18, §27.5)

**Cenário A — MVP individual (entregue):**
- `localStorage` do navegador via hooks (`usePricing` → entrada; `useTheme` → tema; `B2cPanel` →
  estado B2C; sequência de id de proposta).
- **Limitações explícitas:** dados **não** sincronizados entre usuários ou dispositivos; sem
  autenticação, sem aprovação institucional, sem unicidade global — o `BONDLY-2027-NNNNNN` é
  sequencial **por navegador**. Avisado na própria UI.
- Sem segredos no frontend. Nenhuma variável `VITE_*` carrega credencial.

**Cenário B — operação compartilhada (evolução, não entregue):**
- Exigiria backend, autenticação, autorização por perfil, banco durável, trilha de auditoria e
  identificadores únicos globais — sujeitos a escolha e aprovação de infraestrutura (§27.5).
- O Pricing Engine já está pronto para isso: contratos estáveis, snapshot imutável e versionamento
  permitem persistir propostas num banco sem tocar nas fórmulas.
