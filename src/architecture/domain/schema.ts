import { z } from 'zod';
import { SCHEMA_VERSION } from './types';

const provenanceSchema = z.enum([
  'declared',
  'user_confirmed',
  'assumed',
  'computed',
]);

function knownQuantitySchema<U extends string>(unit: U) {
  return z
    .object({
      state: z.literal('known'),
      value: z.number().finite(),
      unit: z.literal(unit),
      provenance: provenanceSchema,
      note: z.string().min(1).optional(),
    })
    .strict();
}

function unknownQuantitySchema<U extends string>(unit: U) {
  return z
    .object({
      state: z.literal('unknown'),
      unit: z.literal(unit),
      reason: z.string().min(1).optional(),
    })
    .strict();
}

function quantitySchema<U extends string>(unit: U) {
  return z.discriminatedUnion('state', [
    knownQuantitySchema(unit),
    unknownQuantitySchema(unit),
  ]);
}

const countKnown = knownQuantitySchema('count').superRefine((q, ctx) => {
  if (!Number.isInteger(q.value) || q.value < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'count must be a non-negative integer',
    });
  }
});

const replicasKnown = knownQuantitySchema('count').superRefine((q, ctx) => {
  if (!Number.isInteger(q.value) || q.value < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'replicas must be an integer >= 1 when known',
    });
  }
});

const countQuantity = z.discriminatedUnion('state', [
  countKnown,
  unknownQuantitySchema('count'),
]);

const replicasQuantity = z.discriminatedUnion('state', [
  replicasKnown,
  unknownQuantitySchema('count'),
]);

const rpsQuantity = quantitySchema('rps').superRefine((q, ctx) => {
  if (q.state === 'known' && q.value < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'rps must be >= 0',
    });
  }
});

const msQuantity = quantitySchema('ms').superRefine((q, ctx) => {
  if (q.state === 'known' && q.value < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ms must be >= 0',
    });
  }
});

const percentQuantity = quantitySchema('percent').superRefine((q, ctx) => {
  if (q.state === 'known' && (q.value < 0 || q.value > 100)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'percent must be between 0 and 100',
    });
  }
});

const ratioQuantity = quantitySchema('ratio').superRefine((q, ctx) => {
  if (q.state === 'known' && q.value <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ratio must be > 0',
    });
  }
});

const anyQuantity = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('known'),
      value: z.number().finite(),
      unit: z.enum(['rps', 'ms', 'count', 'percent', 'ratio']),
      provenance: provenanceSchema,
      note: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      state: z.literal('unknown'),
      unit: z.enum(['rps', 'ms', 'count', 'percent', 'ratio']),
      reason: z.string().min(1).optional(),
    })
    .strict(),
]);

const backoffSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }).strict(),
  z
    .object({
      type: z.literal('fixed'),
      delayMs: msQuantity,
    })
    .strict(),
  z
    .object({
      type: z.literal('exponential'),
      initialDelayMs: msQuantity,
      multiplier: ratioQuantity,
    })
    .strict(),
]);

const retrySchema = z
  .object({
    additionalAttempts: countQuantity,
    backoff: backoffSchema,
  })
  .strict();

const fieldConflictSchema = z
  .object({
    field: z.string().min(1),
    candidates: z.array(anyQuantity).min(2),
    note: z.string().min(1).optional(),
  })
  .strict();

const capacityAggregationSchema = z.enum([
  'sum_replicas',
  'primary_only',
  'unknown',
]);

const nodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['service', 'datastore', 'queue']),
    name: z.string().min(1),
    replicas: replicasQuantity.optional(),
    capacityPerReplica: rpsQuantity.optional(),
    capacityAggregation: capacityAggregationSchema.optional(),
    declaredLatency: msQuantity.optional(),
    fieldConflicts: z.array(fieldConflictSchema).optional(),
  })
  .strict();

const dependencySchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    communication: z.enum(['sync', 'async']),
    timeout: msQuantity.optional(),
    retry: retrySchema.optional(),
  })
  .strict();

const assumptionSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    provenance: provenanceSchema,
    fieldsAffected: z.array(z.string().min(1)),
  })
  .strict();

const documentConflictSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    nodeIds: z.array(z.string().min(1)),
    field: z.string().min(1).optional(),
    candidates: z.array(anyQuantity).min(2),
  })
  .strict();

const systemSchema = z
  .object({
    incomingTraffic: rpsQuantity.optional(),
    availabilityTarget: percentQuantity.optional(),
  })
  .strict();

export const architectureDocumentSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    nodes: z.array(nodeSchema),
    dependencies: z.array(dependencySchema),
    system: systemSchema.optional(),
    assumptions: z.array(assumptionSchema).default([]),
    conflicts: z.array(documentConflictSchema).default([]),
  })
  .strict();

export type ArchitectureDocumentInput = z.input<
  typeof architectureDocumentSchema
>;
