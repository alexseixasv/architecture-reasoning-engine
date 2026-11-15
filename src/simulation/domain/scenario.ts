import { z } from 'zod';

export const scenarioSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('component_unavailable'),
      componentId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('latency_degradation'),
      componentId: z.string().min(1),
      latencyMs: z.number().finite().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal('load_multiplication'),
      multiplier: z.number().finite().positive(),
    })
    .strict(),
]);

export type Scenario = z.infer<typeof scenarioSchema>;
