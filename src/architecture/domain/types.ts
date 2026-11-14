/** Pure domain types — no NestJS, Drizzle, or HTTP imports. */

export const SCHEMA_VERSION = '1.0.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export type Provenance = 'declared' | 'user_confirmed' | 'assumed' | 'computed';

export type Unit = 'rps' | 'ms' | 'count' | 'percent' | 'ratio';

export type FindingSeverity = 'ERROR' | 'WARNING' | 'MISSING_INFORMATION';

export type FindingClass =
  | 'schema'
  | 'referential'
  | 'semantic'
  | 'simulation_readiness';

/** Blocks persistence when severity is ERROR. */
export type PersistenceEffect = 'reject' | 'allow';

export type KnownQuantity<U extends Unit = Unit> = {
  state: 'known';
  value: number;
  unit: U;
  provenance: Provenance;
  note?: string;
};

export type UnknownQuantity<U extends Unit = Unit> = {
  state: 'unknown';
  unit: U;
  reason?: string;
};

export type Quantity<U extends Unit = Unit> = KnownQuantity<U> | UnknownQuantity<U>;

/**
 * How replica capacity may be aggregated for this node.
 * Phase 3 must not infer aggregation from replica count alone.
 */
export type CapacityAggregation = 'sum_replicas' | 'primary_only' | 'unknown';

export type Backoff =
  | { type: 'none' }
  | { type: 'fixed'; delayMs: Quantity<'ms'> }
  | {
      type: 'exponential';
      initialDelayMs: Quantity<'ms'>;
      multiplier: Quantity<'ratio'>;
    };

export type RetryPolicy = {
  /** Extra attempts after the first call — not total tries. */
  additionalAttempts: Quantity<'count'>;
  backoff: Backoff;
};

export type NodeKind = 'service' | 'datastore' | 'queue';

export type ArchitectureNode = {
  id: string;
  kind: NodeKind;
  name: string;
  replicas?: Quantity<'count'>;
  capacityPerReplica?: Quantity<'rps'>;
  /**
   * Required in stored models when capacityPerReplica or replicas
   * related capacity analysis is intended. Explicit — never inferred.
   */
  capacityAggregation?: CapacityAggregation;
  declaredLatency?: Quantity<'ms'>;
  /** Conflicting declarations for the same field; no auto-resolution. */
  fieldConflicts?: FieldConflict[];
};

export type FieldConflict = {
  field: string;
  candidates: Quantity[];
  note?: string;
};

export type CommunicationType = 'sync' | 'async';

export type ArchitectureDependency = {
  id: string;
  from: string;
  to: string;
  communication: CommunicationType;
  timeout?: Quantity<'ms'>;
  retry?: RetryPolicy;
};

export type Assumption = {
  id: string;
  text: string;
  provenance: Provenance;
  fieldsAffected: string[];
};

export type DocumentConflict = {
  id: string;
  description: string;
  nodeIds: string[];
  field?: string;
  candidates: Quantity[];
};

export type SystemProperties = {
  incomingTraffic?: Quantity<'rps'>;
  availabilityTarget?: Quantity<'percent'>;
};

export type ArchitectureDocument = {
  schemaVersion: SchemaVersion;
  name?: string;
  description?: string;
  nodes: ArchitectureNode[];
  dependencies: ArchitectureDependency[];
  system?: SystemProperties;
  assumptions: Assumption[];
  conflicts: DocumentConflict[];
};

export type ValidationFinding = {
  code: string;
  severity: FindingSeverity;
  findingClass: FindingClass;
  /** Whether this finding alone blocks persistence. */
  persistenceEffect: PersistenceEffect;
  path: string;
  message: string;
  relatedIds?: string[];
};

export type ValidationResult = {
  ok: boolean;
  document?: ArchitectureDocument;
  findings: ValidationFinding[];
  canPersist: boolean;
};

export type IncompleteInfoAction = 'ASK' | 'ASSUME' | 'REFUSE';

export type CompletenessGap = {
  field: string;
  action: IncompleteInfoAction;
  reason: string;
  relatedIds?: string[];
};

export type DiffChangeKind = 'added' | 'removed' | 'changed';

export type DiffChange = {
  entityType: 'node' | 'dependency' | 'assumption' | 'conflict' | 'system' | 'meta';
  id: string;
  path: string;
  kind: DiffChangeKind;
  before?: unknown;
  after?: unknown;
};

export type DocumentDiff = {
  fromVersion?: number;
  toVersion?: number;
  changes: DiffChange[];
};
