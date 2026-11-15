import type { Provenance } from '../../architecture/domain/types';
import type { MetricEvidence, MetricUnit } from '../domain/result';

export function evidence(input: {
  metricId: string;
  value: number;
  unit: MetricUnit;
  formulaId: string;
  inputs: {
    path: string;
    value: number;
    unit: MetricUnit;
    provenance?: Provenance;
  }[];
  substitutions: string[];
  result: string;
}): MetricEvidence {
  return {
    metricId: input.metricId,
    value: input.value,
    unit: input.unit,
    formulaId: input.formulaId,
    inputs: input.inputs.map((i) => {
      const row: MetricEvidence['inputs'][number] = {
        path: i.path,
        value: i.value,
        unit: i.unit,
      };
      if (i.provenance !== undefined) {
        row.provenance = i.provenance;
      }
      return row;
    }),
    substitutions: input.substitutions,
    result: input.result,
  };
}

export function sortMetrics(metrics: MetricEvidence[]): MetricEvidence[] {
  return [...metrics].sort((a, b) => a.metricId.localeCompare(b.metricId));
}
