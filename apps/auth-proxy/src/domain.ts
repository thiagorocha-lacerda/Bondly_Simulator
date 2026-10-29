/**
 * Domínio de propostas, esteira e auditoria (prompt §5, §8) + contrato de repositório (§1.1 do doc 10).
 *
 * O repositório guarda INPUTS (comercial/técnico), estado, snapshot e histórico — NÃO duplica regra
 * de cálculo (a fonte única é o Pricing Engine, §8). A interface isola o backend: a implementação
 * inicial é in-memory (testes) / SQLite (produção), trocável por Postgres sem tocar as rotas.
 */
import type { Role } from './rbac.js';

/** Estados da esteira Negócios→P&T (§5.2). */
export type WorkflowState =
  | 'rascunho_comercial'
  | 'aguardando_analise_tecnica'
  | 'em_analise_tecnica'
  | 'ajustes_solicitados'
  | 'aprovado_tecnicamente'
  | 'reprovado'
  | 'pronto_para_emissao'
  | 'emitido';

/**
 * Entradas comerciais (preenchidas por Negócios). Mantidas como JSON opaco do ponto de vista do
 * repositório — o shape canônico é o PricingInput do engine; aqui guardamos o que a proposta carrega.
 */
export type CommercialInput = Record<string, unknown>;

/** Entradas técnicas (preenchidas por P&T): integrações, complexidade, horas, parecer. */
export interface TechnicalInput {
  readonly integrations?: number;
  readonly complexityNote?: string;
  readonly implementationHours?: number;
  readonly risks?: string;
  readonly verdict?: 'aprovado' | 'ajustes' | 'reprovado';
  readonly verdictNote?: string;
}

/** Proposta persistida. `version` é o lock otimista (§5.2). */
export interface Proposal {
  readonly id: string; // BONDLY-2027-NNNNNN
  readonly version: number;
  readonly status: WorkflowState;
  readonly ownerEmail: string;
  readonly commercial: CommercialInput;
  readonly technical?: TechnicalInput;
  /** Snapshot congelado na aprovação técnica (JSON do ProposalSnapshot do engine). */
  readonly snapshot?: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Entrada de auditoria imutável (§5.2 / §8). */
export interface AuditEntry {
  readonly id: string;
  readonly proposalId: string;
  readonly actorEmail: string;
  readonly role: Role;
  readonly action: string;
  readonly fromState?: WorkflowState;
  readonly toState?: WorkflowState;
  readonly note?: string;
  readonly at: string;
}

export interface CreateProposalArgs {
  readonly id: string;
  readonly ownerEmail: string;
  readonly commercial: CommercialInput;
}

/** Erro de concorrência (optimistic lock) — escrita com versão defasada (§5.2). */
export class VersionConflictError extends Error {
  constructor(
    readonly id: string,
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`conflito de versão em ${id}: esperado ${expected}, atual ${actual}`);
    this.name = 'VersionConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(readonly id: string) {
    super(`proposta não encontrada: ${id}`);
    this.name = 'NotFoundError';
  }
}

/** Identificador de proposta `BONDLY-2027-NNNNNN` (§15). Local ao BFF para não acoplar ao engine. */
export function formatProposalId(sequence: number, year = 2027): string {
  return `BONDLY-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Contrato do repositório. Toda mutação exige `expectedVersion` (lock otimista) e devolve a proposta
 * com a versão incrementada. Grava a auditoria na MESMA operação lógica (append-only).
 */
export interface ProposalRepository {
  nextSequence(): Promise<number>;
  create(args: CreateProposalArgs, audit: Omit<AuditEntry, 'id' | 'proposalId' | 'at'>): Promise<Proposal>;
  get(id: string): Promise<Proposal | null>;
  list(): Promise<readonly Proposal[]>;
  /**
   * Aplica uma mutação (patch parcial de status/commercial/technical/snapshot) sob lock otimista,
   * gravando a auditoria. Lança VersionConflictError / NotFoundError.
   */
  update(
    id: string,
    expectedVersion: number,
    patch: Partial<Pick<Proposal, 'status' | 'commercial' | 'technical' | 'snapshot'>>,
    audit: Omit<AuditEntry, 'id' | 'proposalId' | 'at'>,
  ): Promise<Proposal>;
  audit(id: string): Promise<readonly AuditEntry[]>;
}
