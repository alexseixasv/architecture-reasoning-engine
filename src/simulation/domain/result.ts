import type { Provenance, Unit } from '../../architecture/domain/types';
import type { Scenario } from './scenario';

export type Answerability = 'ANSWERED' | 'PARTIALLY_ANSWERED' | 'NOT_ANSWERABLE';

export type MetricUnit = Unit | 'attempts_per_s';

export type MetricEvidence = {
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
};

export type RefusedMetric = {
  metricId: string;
  reasonCode: string;
  message: string;
  missingPaths?: string[];
};

export type ComponentImpact = {
  componentId: string;
  impact:
    | 'unavailable'
    | 'sync_failure_exposed'
    | 'sync_transitively_exposed'
    | 'async_dependent'
    | 'unaffected';
  via: 'direct' | 'sync_direct' | 'sync_transitive' | 'async' | 'none';
  path: string[];
};

export type PropagationPath = {
  componentId: string;
  path: string[];
};

export type SaturationClassification = {
  componentId: string;
  saturated: boolean;
  utilization?: number;
  offeredLoadRps?: number;
  capacityRps?: number;
};

export type SimulationAssumption = {
  id: string;
  text: string;
};

export type SimulationResult = {
  scenario: Scenario;
  status: Answerability;
  metrics: MetricEvidence[];
  refused: RefusedMetric[];
  impacts: ComponentImpact[];
  saturations: SaturationClassification[];
  assumptions: SimulationAssumption[];
  warnings: string[];
  propagationPaths: PropagationPath[];
};
