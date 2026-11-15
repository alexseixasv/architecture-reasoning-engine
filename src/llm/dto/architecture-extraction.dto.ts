import { z } from 'zod';

/**
 * LLM-facing DTO for Structured Outputs.
 * Every declared numeric fact requires sourceExcerpt verified against source text.
 */
const declaredNumber = z
  .object({
    presence: z.literal('declared'),
    value: z.number().finite(),
    unit: z.enum(['rps', 'ms', 'count', 'percent', 'ratio']),
    /** Exact substring from the architecture description. */
    sourceExcerpt: z.string().min(1),
  })
  .strict();

const unknownNumber = z
  .object({
    presence: z.literal('unknown'),
    unit: z.enum(['rps', 'ms', 'count', 'percent', 'ratio']),
    reason: z.string(),
  })
  .strict();

const omittedNumber = z
  .object({
    presence: z.literal('omitted'),
  })
  .strict();

export const extractedQuantitySchema = z.discriminatedUnion('presence', [
  declaredNumber,
  unknownNumber,
  omittedNumber,
]);

export type ExtractedQuantity = z.infer<typeof extractedQuantitySchema>;

const conflictCandidateSchema = z
  .object({
    value: z.number().finite(),
    unit: z.enum(['rps', 'ms', 'count', 'percent', 'ratio']),
    sourceExcerpt: z.string().min(1),
  })
  .strict();

const nodeConflictSchema = z
  .object({
    field: z.string().min(1),
    candidates: z.array(conflictCandidateSchema).min(2),
    note: z.string(),
  })
  .strict();

const extractedNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['service', 'datastore', 'queue']),
    name: z.string().min(1),
    replicas: extractedQuantitySchema,
    capacityPerReplica: extractedQuantitySchema,
    capacityAggregation: z.enum([
      'sum_replicas',
      'primary_only',
      'unknown',
      'omitted',
    ]),
    declaredLatency: extractedQuantitySchema,
    fieldConflicts: z.array(nodeConflictSchema),
  })
  .strict();

const backoffSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }).strict(),
  z
    .object({
      type: z.literal('fixed'),
      delayMs: extractedQuantitySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('exponential'),
      initialDelayMs: extractedQuantitySchema,
      multiplier: extractedQuantitySchema,
    })
    .strict(),
  z.object({ type: z.literal('omitted') }).strict(),
]);

const retrySchema = z.discriminatedUnion('presence', [
  z
    .object({
      presence: z.literal('declared'),
      additionalAttempts: extractedQuantitySchema,
      backoff: backoffSchema,
    })
    .strict(),
  z.object({ presence: z.literal('omitted') }).strict(),
]);

const extractedDependencySchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    communication: z.enum(['sync', 'async']),
    timeout: extractedQuantitySchema,
    retry: retrySchema,
    requestsPerParent: extractedQuantitySchema,
  })
  .strict();

const documentConflictSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    nodeIds: z.array(z.string().min(1)),
    field: z.string(),
    candidates: z.array(conflictCandidateSchema).min(2),
  })
  .strict();

export const architectureExtractionDtoSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    nodes: z.array(extractedNodeSchema),
    dependencies: z.array(extractedDependencySchema),
    incomingTraffic: extractedQuantitySchema,
    availabilityTarget: extractedQuantitySchema,
    ingressNodeIds: z.array(z.string()),
    ingressDeclared: z.boolean(),
    documentConflicts: z.array(documentConflictSchema),
    clarificationQuestions: z.array(z.string()),
    notes: z.array(z.string()),
  })
  .strict();

export type ArchitectureExtractionDto = z.infer<
  typeof architectureExtractionDtoSchema
>;

export const ARCHITECTURE_EXTRACTION_SCHEMA_NAME = 'architecture_extraction';
