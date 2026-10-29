/**
 * Papéis e decisão de autorização RBAC (prompt §6).
 *
 * Função PURA e exaustivamente testável — espelha o padrão de `authz.ts` (autorização por domínio).
 * O enforcement real roda no servidor (server.ts chama `can(...)` em TODA rota sensível). O React
 * nunca é a fronteira de segurança (§6: "ocultar campos no React não constitui proteção").
 */

/** Papéis operacionais + administrativo (§6.1). */
export type Role = 'business' | 'tech' | 'admin';

export const ROLES: readonly Role[] = ['business', 'tech', 'admin'];

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/**
 * Ações sensíveis do sistema. Cada rota/ação do servidor mapeia para uma destas.
 * `see_internal` governa custo/margem/breakdown técnico — a linha que separa Negócios de P&T (§6.2/§6.3).
 */
export type Action =
  | 'proposal.create'
  | 'proposal.read'
  | 'proposal.edit_commercial'
  | 'proposal.edit_technical'
  | 'proposal.edit_tier_discount'
  | 'proposal.see_internal' // custo, margem, breakdown técnico
  | 'proposal.validate_technical'
  | 'proposal.emit'
  | 'proposal.read_audit_full'
  | 'admin.manage_users';

/** Matriz inicial (§6.1) — refinável após auditoria das necessidades reais. */
const MATRIX: Readonly<Record<Role, ReadonlySet<Action>>> = {
  business: new Set<Action>([
    'proposal.create',
    'proposal.read',
    'proposal.edit_commercial',
    'proposal.edit_tier_discount',
    'proposal.emit', // só após aprovação exigida — validado também pela máquina de estados
  ]),
  tech: new Set<Action>([
    'proposal.read',
    'proposal.edit_technical',
    'proposal.see_internal',
    'proposal.validate_technical',
    'proposal.read_audit_full',
  ]),
  admin: new Set<Action>([
    'proposal.read',
    'proposal.see_internal',
    'proposal.read_audit_full',
    'admin.manage_users',
  ]),
};

/** Decisão pura: o papel pode executar a ação? `undefined`/papel inválido ⇒ false (deny-by-default). */
export function can(role: Role | undefined, action: Action): boolean {
  if (!role || !isRole(role)) return false;
  return MATRIX[role].has(action);
}

/** Conveniência: o papel enxerga dados internos (custo/margem/breakdown)? */
export function canSeeInternal(role: Role | undefined): boolean {
  return can(role, 'proposal.see_internal');
}
