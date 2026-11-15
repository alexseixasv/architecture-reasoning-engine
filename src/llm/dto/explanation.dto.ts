import { z } from 'zod';

/**
 * Qualitative explanation only. No numerical result fields.
 *
 * Reference fields are mutually role-specific:
 * - metricIds → SimulationResult.metrics only (calculated)
 * - refusedMetricIds → SimulationResult.refused[].metricId only (not calculated)
 * - refusalCodes → SimulationResult.refused[].reasonCode only
 * - componentIds → impact/saturation/propagation component ids
 */
export const explanationDtoSchema = z
  .object({
    summary: z.string().min(1),
    statements: z.array(
      z
        .object({
          text: z.string().min(1),
          /** Calculated metrics only — never refused output ids. */
          metricIds: z.array(z.string()),
          /** Refused/unsupported output metric ids (not calculated values). */
          refusedMetricIds: z.array(z.string()),
          componentIds: z.array(z.string()),
          /** Engine reason codes only (e.g. NO_AVAILABILITY_MODEL). */
          refusalCodes: z.array(z.string()),
          claimKind: z.enum([
            'exposure_not_outage',
            'saturation_classification',
            'missing_information',
            'refusal_preserved',
            'path_description',
            'assumption_visible',
            'general',
          ]),
        })
        .strict(),
    ),
    acknowledgedStatus: z.enum([
      'ANSWERED',
      'PARTIALLY_ANSWERED',
      'NOT_ANSWERABLE',
    ]),
  })
  .strict();

export type ExplanationDto = z.infer<typeof explanationDtoSchema>;

export const EXPLANATION_SCHEMA_NAME = 'grounded_explanation';

export const FORBIDDEN_CLAIM_KINDS = [
  'proven_outage',
  'invented_availability',
  'attempt_rate_as_throughput',
  'invented_percentile',
] as const;
