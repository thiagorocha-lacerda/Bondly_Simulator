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
há passo de build intermediário do pacote em dev. A Vercel compila o mesmo source no build.

## Deploy na Vercel (§27) — PRONTO, não executado

A entrega está **pronta para publicar**, mas o deploy **não foi realizado**: exige acesso à conta
Vercel e ao repositório, que não temos. Não há URL de produção inventada.

Configuração já versionada em `vercel.json`:

| Campo | Valor |
|---|---|
| Framework | `vite` |
| Install Command | `npm install` |
| Build Command | `npm run build --workspace @bondly/commercial-workspace` |
| Output Directory | `apps/commercial-workspace/dist` |
| Root Directory | a raiz do monorepo (`bondly-commercial-platform/`) |
| SPA fallback | rewrite de todas as rotas (exceto `/assets/*`) para `/index.html` |

### Passos para publicar (quando houver acesso)

1. Conectar o repositório na Vercel; definir Root Directory = `bondly-commercial-platform`.
2. A Vercel lê `vercel.json` (build/output/rewrites). Confirmar Node 20+ no projeto.
3. Variáveis de ambiente: ver `.env.example`. **Cenário A não exige segredos**; nunca colocar
   credenciais em `VITE_*` (vão para o bundle do cliente).
4. Deploy de **Preview** por pull request; promover para **Production** na branch de produção.
5. Rodar o checklist de homologação (`docs/03-checklist-homologacao.md`) na URL real.

### Variáveis de ambiente

Nenhuma obrigatória na entrega atual (SPA estática, armazenamento local). Variáveis do Cenário B
(backend/auth/DB) ficam documentadas em `.env.example` e **não** são prefixadas por `VITE_`.

## Rollback e recuperação (§27.7)

- **Rollback de deploy:** na Vercel, Deployments → selecionar o último deploy estável → *Promote to
  Production* (instantâneo, troca o alias de produção). Alternativa CLI: `vercel rollback <url>`.
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
