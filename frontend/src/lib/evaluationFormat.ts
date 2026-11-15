import type { EvaluationCaseResult } from '@/api/types';

/** Compact label from backend outcome objects — never invents metrics. */
export function outcomeLabel(outcome: unknown): string {
  if (outcome === null || outcome === undefined) {
    return '—';
  }
  if (typeof outcome !== 'object') {
    return String(outcome);
  }
  const o = outcome as Record<string, unknown>;
  if (typeof o['status'] === 'string') {
    return o['status'];
  }
  if (typeof o['execution'] === 'string') {
    const parts = [o['execution']];
    if (o['schemaValid'] === true) parts.push('schemaValid');
    if (o['nlNotPassedToSimulate'] === true) parts.push('NL unused');
    return parts.join(' · ');
  }
  if (typeof o['utilizationApi'] === 'number') {
    return `utilization:api=${o['utilizationApi']}`;
  }
  if (typeof o['schemaSuccess'] === 'boolean') {
    return o['schemaSuccess'] ? 'schema accept' : 'schema reject';
  }
  if (typeof o['resultsEqual'] === 'boolean') {
    return o['resultsEqual'] ? 'results equal' : 'results differ';
  }
  return 'see detail';
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) {
    return '—';
  }
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatF1(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(2);
}

export function formatRatio(
  ok: number | undefined,
  denom: number | undefined,
): string {
  if (ok === undefined || denom === undefined) return '—';
  return `${ok} / ${denom}`;
}

export function checkKindLabel(kind: EvaluationCaseResult['checkKind']): string {
  switch (kind) {
    case 'simulation_correctness':
      return 'Simulation correctness';
    case 'schema_validation':
      return 'Schema validation';
    case 'formal_scenario_validation':
      return 'Formal scenario validation';
    case 'adversarial_deterministic':
      return 'Adversarial deterministic';
    case 'nl_isolation_check':
      return 'NL isolation (not LLM injection)';
    default:
      return kind;
  }
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
}
