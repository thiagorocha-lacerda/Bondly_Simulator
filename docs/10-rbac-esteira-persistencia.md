# Fase 3 — RBAC, esteira Negócios→P&T e persistência (prompt §5, §6, §7, §8, §12)

> Status: **em implementação**. Este documento é o contrato de execução da Fase 3. Decisões marcadas
> **PENDENTE** dependem de aprovação (comercial ou de segurança) e não são tratadas como validadas.

## 0. Ponto de partida (o que já existe)

- **Opção B** entregue: `@bondly/auth-proxy` (Web Service Node) com Google SSO + PKCE, autorização
  **estrita por domínio**, sessão HMAC stateless (cookie `bondly_sess`, 8h), gate de borda.
- **NÃO existe** hoje: conceito de papel (RBAC), persistência server-side, APIs de proposta, esteira.
- A sessão carrega só `email/name/picture/domain/exp`.

## 1. Decisões de arquitetura

### 1.1 Persistência — camada de dados ABSTRATA (decisão do usuário)
Repositório com **interface única** (`ProposalRepository`, `AuditRepository`), implementação inicial
**SQLite** via `node:sqlite` (nativo do Node 22 — sem dependência nativa extra), trocável por Postgres
sem tocar as rotas. Na Render exige um **Disk** (persistente) montado; o caminho vem de `DATA_DIR`
(default `./data` em dev). Em teste, implementação **in-memory** do mesmo contrato.

> Trade-off honesto: `node:sqlite` é experimental no Node 22 (emite `ExperimentalWarning`). A interface
> isola esse risco — se incomodar, troca-se por `better-sqlite3` ou Postgres implementando o mesmo
> contrato, sem mudar o restante.

### 1.2 Hash dos códigos de perfil — scrypt nativo (§7.3)
O §7.3 pede **Argon2id**. Para não adicionar dependência nativa (build toolchain na Render) usamos
**scrypt** (`node:crypto`, memory-hard, com sal aleatório por código e parâmetros adequados) atrás de
uma interface `PasswordHasher`. Argon2id continua sendo a **preferência**; a interface torna a troca
trivial se o `argon2` for aprovado como dependência. **Decisão de parâmetro/algoritmo: PENDENTE** de
sign-off de segurança; o default scrypt é seguro e não bloqueia a entrega.

### 1.3 Papéis e o 2º fator (§6/§7.2)
Dois papéis: **`business`** (Negócios) e **`tech`** (Projetos & Tecnologia). Um 3º papel **`admin`**
é reservado para administração de usuários/credenciais/políticas (§6.1 última linha) — **não** editável
pelos dois papéis operacionais.

O 2º fator é um **código de desbloqueio de perfil** (§7.2), validado no servidor, que eleva a sessão
já autenticada por Google a um papel. **Não substitui** o SSO nem identidade individual (§7.2): a
auditoria amarra sempre o papel ao e-mail Google. Códigos ficam só como **hash** (scrypt) em `DATA_DIR`
ou env, nunca em texto puro, nunca no bundle.

Fluxo: Google SSO (como hoje) → tela de código de perfil → `POST /api/profile/unlock {role, code}` →
servidor valida o hash, grava `role` na sessão (novo campo assinado) → acesso liberado conforme RBAC.

### 1.4 RBAC — decisão PURA + enforcement no servidor (§6)
`authorize(action, role)` é uma função pura e exaustivamente testável (como `authz.ts`). TODA rota
`/api/*` sensível chama o enforcement **no servidor**; o React nunca é a fronteira. Payloads das APIs
são **filtrados por papel** na origem (§8): Negócios nunca recebe custo/margem/breakdown técnico.

### 1.5 Esteira Negócios→P&T — máquina de estados server-side (§5)
Estados: `rascunho_comercial → aguardando_analise_tecnica → em_analise_tecnica →
ajustes_solicitados | aprovado_tecnicamente | reprovado → pronto_para_emissao → emitido`.
Transições válidas definidas numa tabela pura; cada transição valida papel + estado atual no servidor
e grava **auditoria**. Aprovação vincula-se a um **snapshot** da proposta (reusa `createProposalSnapshot`
do engine). Mudança material (módulos, volumes, integrações, horas, descontos, condições) **invalida**
aprovações afetadas e retorna ao estado apropriado (§5.2). Concorrência: cada proposta tem `version`
(optimistic locking) — escrita com versão defasada é recusada (§5.2).

## 2. Modelo de dados (contrato do repositório)

```
Proposal {
  id            BONDLY-2027-NNNNNN
  version       int            # optimistic lock
  status        WorkflowState
  ownerEmail    string         # Negócios que criou
  commercial    PricingInput (parte comercial)   # entradas de Negócios
  technical     TechnicalInput?                   # entradas de P&T (horas, integrações, complexidade)
  snapshot      ProposalSnapshot?                 # congelado na aprovação
  createdAt, updatedAt
}
AuditEntry { id, proposalId, actor(email), role, action, fromState?, toState?, note?, at }
```

As entradas financeiras seguem no Pricing Engine (fonte única §8); o repositório guarda inputs, estado,
snapshot e histórico — não duplica regra de cálculo.

## 3. APIs (todas atrás do gate de sessão + RBAC)

| Rota | Método | Papel | Retorno filtrado |
|---|---|---|---|
| `/api/me` | GET | qualquer sessão | identidade + papel atual |
| `/api/profile/unlock` | POST | sessão sem papel | eleva a sessão ao papel (valida código) |
| `/api/proposals` | GET | business, tech | lista (campos conforme papel) |
| `/api/proposals` | POST | business | cria rascunho comercial |
| `/api/proposals/:id` | GET | business, tech | business: sem custo/margem; tech: completo |
| `/api/proposals/:id/commercial` | PUT | business | edita inputs comerciais (optimistic lock) |
| `/api/proposals/:id/technical` | PUT | tech | edita inputs técnicos (horas/integrações) |
| `/api/proposals/:id/transition` | POST | conforme matriz | muda estado + auditoria |
| `/api/proposals/:id/audit` | GET | business (resumo), tech (completo) | histórico |

Negação: 401 sem sessão, 403 sem papel/ação. Nenhum payload completo vai para Negócios para “esconder
no front” (§8).

## 4. Matriz RBAC inicial (§6.1 — refinável)

| Ação | business | tech | admin |
|---|---|---|---|
| Criar/editar inputs comerciais | ✎ | 👁 | 👁 |
| Editar desconto por tier (3–7%) | ✎ | 👁/valida | 👁 |
| Ver preços/Setup/TCV | ✔ | ✔ | ✔ |
| Editar integrações/complexidade/horas | solicita | ✎ | 👁 |
| Ver custo interno/margem/breakdown técnico | ✗ | ✔ | ✔ |
| Validar tecnicamente / parecer | ✗ | ✔ | 👁 |
| Transição para emitido | ✔ (pós-aprovação) | conforme política | 👁 |
| Administrar usuários/credenciais/políticas | ✗ | ✗ | ✔ |

## 5. Plano incremental (cada passo compila, testa e tem CI verde)

1. **Papéis + RBAC puro** (`roles.ts`, `rbac.ts`) + testes de bypass. Sessão ganha `role?`.
2. **2º fator** (`profileCodes.ts` com `PasswordHasher` scrypt) + `POST /api/profile/unlock` + testes
   (código certo/errado, brute-force/rate-limit, papel na sessão).
3. **Repositório abstrato** (`repository.ts` interface + `sqliteRepository.ts` + `memoryRepository.ts`)
   + testes do contrato.
4. **APIs de proposta filtradas por papel** + testes de payload por papel (Negócios não vê custo).
5. **Máquina de estados da esteira** (`workflow.ts` puro) + `/transition` + auditoria + invalidação por
   mudança material + optimistic lock + testes.
6. **UI**: stepper por fase, tela de código de perfil, visões segregadas consumindo as APIs.
7. **Deploy**: `render.yaml` com Disk + `DATA_DIR`; doc de operação; migrações/backup/rollback.

## 6. Critérios de aceite cobertos (§14)

Permissões restringem **dados e ações no servidor** (não só visual); Google SSO preservado; os 2
códigos validados com segurança sem substituir identidade; nada confidencial antes de autorização;
aprovações auditáveis e invalidadas por mudança relevante; Render preservado (Web Service + Disk).

## 7. O que permanece PENDENTE (não inventado)

- Valores/algoritmo final do hash (Argon2id vs scrypt) — sign-off de segurança.
- Os **códigos de perfil** reais (definidos pelo admin, nunca no repositório/bundle).
- Política fina da matriz RBAC após auditoria das necessidades reais.
- Escolha final SQLite vs Postgres (interface já isola).
