# Execução, build e deploy — Bondly Commercial Platform

Monorepo npm workspaces. Node ≥ 20.

## Instalação

```bash
npm install
```

## Comandos

| Objetivo | Comando |
|---|---|
| Testes do motor (40) | `npm run test` |
| Typecheck de tudo | `npm run typecheck` |
| Dev do workspace | `npm run dev --workspace @bondly/commercial-workspace` → http://127.0.0.1:5173 |
| Build de produção | `npm run build --workspace @bondly/commercial-workspace` → `apps/commercial-workspace/dist/` |
| Preview do build | `npm run preview --workspace @bondly/commercial-workspace` → http://127.0.0.1:4173 |

O workspace resolve o Pricing Engine pela **fonte TypeScript** (alias Vite + tsconfig paths), então não
há passo de build intermediário do pacote em dev. A Render compila o mesmo source no build.

## Deploy na Render (§27) — PRONTO, não executado

A entrega está **pronta para publicar** como **Static Site** na Render, mas o deploy **não foi
realizado**: exige acesso à conta Render e ao repositório. Não há URL de produção inventada.

Configuração já versionada em `render.yaml` (Blueprint):

| Campo | Valor |
|---|---|
| Tipo de serviço | Static Site (`runtime: static`) |
| Build Command | `npm ci && npm run build --workspace @bondly/commercial-workspace` |
| Publish Directory | `apps/commercial-workspace/dist` |
| Node | `NODE_VERSION=20` |
| SPA fallback | rewrite `/*` → `/index.html`, preservando `/assets/*` |
| Cabeçalhos | cache imutável em `/assets/*`; `X-Content-Type-Options`, `Referrer-Policy` |

### Passos para publicar (quando houver acesso)

1. Render Dashboard → **New** → **Blueprint** → conectar o repositório `Bondly_Simulator`.
2. A Render lê `render.yaml` e cria o Static Site `bondly-simulator` com build/publish/rewrites prontos.
   Alternativa manual: **New → Static Site**, Build Command e Publish Directory da tabela acima.
3. Variáveis de ambiente: ver `.env.example`. **Cenário A não exige segredos**; nunca colocar
   credenciais em `VITE_*` (vão para o bundle do cliente). `NODE_VERSION=20` já vem no Blueprint.
4. Deploy automático a cada push na branch de produção; PR Previews quando habilitados no serviço.
5. Rodar o checklist de homologação (`docs/07-checklist-homologacao.md`) na URL real `*.onrender.com`.

### Variáveis de ambiente

Nenhuma obrigatória na entrega atual (SPA estática, armazenamento local). Variáveis do Cenário B
(backend/auth/DB) ficam documentadas em `.env.example` e **não** são prefixadas por `VITE_`.

## Rollback e recuperação (§27.7)

- **Rollback de deploy:** na Render, serviço → aba **Deploys** → selecionar um deploy estável anterior
  → **Rollback** (ou **Redeploy** daquele commit). A Render mantém o histórico de deploys.
- **Verificação pós-rollback:** abrir a URL de produção, rodar os itens 1–4 do checklist
  (carregamento, refresh em rota interna, 5 módulos, conciliação Setup/mensalidade/TCV).
- **Dados do usuário:** o Cenário A guarda propostas no `localStorage` do navegador; um rollback de
  deploy **não** apaga esses dados. Exportação/importação explícita é a via de backup/portabilidade.
- **Reprodutibilidade financeira:** cada proposta carrega snapshot imutável (versão do motor + hash
  de premissas); atualizar o deploy não altera valores de propostas já emitidas (§27.6).

## Limitações (§18/§27.5)

- **Cenário A (entregue):** armazenamento local no navegador — **não** há persistência compartilhada,
  autenticação, aprovação institucional nem unicidade global de propostas. O identificador
  `BONDLY-2027-NNNNNN` é sequencial **por navegador**.
- **Cenário B (evolução):** para múltiplos usuários, histórico compartilhado e aprovação institucional,
  é necessário backend + banco durável + auth, sujeitos a escolha e aprovação de infraestrutura.
