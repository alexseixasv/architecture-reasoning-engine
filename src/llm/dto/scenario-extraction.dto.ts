import { z } from 'zod';
import { SCENARIO_MISSING_NUMERIC } from './scenario-missing';

export const scenarioExtractionDtoSchema = z
  .object({
    outcome: z.enum([
      'component_unavailable',
      'latency_degradation',
      'load_multiplication',
      'unsupported',
      'needs_clarification',
    ]),
    /** Candidate component id when known; empty string if none. */
    componentId: z.string(),
    /**
     * Absolute latency in ms when known.
     * Use SCENARIO_MISSING_NUMERIC (-1) if not applicable/unknown — never a real latency.
     */
    latencyMs: z.number().finite(),
    /**
     * Load multiplier when known.
     * Use SCENARIO_MISSING_NUMERIC (-1) if not applicable/unknown — never a real multiplier.
     */
    multiplier: z.number().finite(),
    reason: z.string(),
    clarificationQuestions: z.array(z.string()),
  })
  .strict();

export type ScenarioExtractionDto = z.infer<typeof scenarioExtractionDtoSchema>;

export const SCENARIO_EXTRACTION_SCHEMA_NAME = 'scenario_extraction';

export { SCENARIO_MISSING_NUMERIC };
