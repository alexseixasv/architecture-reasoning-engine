import type {
  FindingClass,
  FindingSeverity,
  PersistenceEffect,
  ValidationFinding,
} from './types';

export function finding(input: {
  code: string;
  severity: FindingSeverity;
  findingClass: FindingClass;
  path: string;
  message: string;
  relatedIds?: string[];
}): ValidationFinding {
  const persistenceEffect: PersistenceEffect =
    input.severity === 'ERROR' ? 'reject' : 'allow';

  const result: ValidationFinding = {
    code: input.code,
    severity: input.severity,
    findingClass: input.findingClass,
    persistenceEffect,
    path: input.path,
    message: input.message,
  };

  if (input.relatedIds !== undefined) {
    result.relatedIds = input.relatedIds;
  }

  return result;
}

/**
 * Persistence policy by finding code (documentation + tests).
 *
 * ERROR (reject): SCHEMA_INVALID, DUPLICATE_ID, MISSING_NODE_REF, GRAPH_TOO_LARGE,
 *   INVALID_FIELD_CONFLICT
 * WARNING (allow): SYNC_CYCLE, SYNC_MISSING_TIMEOUT, RETRY_WITHOUT_BACKOFF, SPOF,
 *   CAPACITY_AGGREGATION_UNSPECIFIED, CONTRADICTION_PRESENT
 * MISSING_INFORMATION (allow): MISSING_BASELINE_TRAFFIC, MISSING_CAPACITY
 */
export const FINDING_PERSISTENCE_POLICY = {
  SCHEMA_INVALID: 'reject',
  DUPLICATE_ID: 'reject',
  MISSING_NODE_REF: 'reject',
  GRAPH_TOO_LARGE: 'reject',
  INVALID_FIELD_CONFLICT: 'reject',
  SYNC_CYCLE: 'allow',
  SYNC_MISSING_TIMEOUT: 'allow',
  RETRY_WITHOUT_BACKOFF: 'allow',
  SPOF: 'allow',
  CAPACITY_AGGREGATION_UNSPECIFIED: 'allow',
  CONTRADICTION_PRESENT: 'allow',
  MISSING_BASELINE_TRAFFIC: 'allow',
  MISSING_CAPACITY: 'allow',
} as const;
