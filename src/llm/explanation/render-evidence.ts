import type { SimulationResult } from '../../simulation/domain/result';

export type EvidencePacket = {
  status: SimulationResult['status'];
  /** Calculated metric ids only (SimulationResult.metrics). */
  metricIds: string[];
  /** Refused output metric ids only (SimulationResult.refused[].metricId). */
  refusedMetricIds: string[];
  componentIds: string[];
  /** Refusal reason codes only (SimulationResult.refused[].reasonCode). */
  refusalCodes: string[];
  metrics: {
    metricId: string;
    value: number;
    unit: string;
    formulaId: string;
    substitutions: string[];
    result: string;
  }[];
  refused: { metricId: string; reasonCode: string; message: string }[];
  impacts: {
    componentId: string;
    impact: string;
    path: string[];
  }[];
  saturations: {
    componentId: string;
    saturated: boolean;
    utilization?: number;
    offeredLoadRps?: number;
    capacityRps?: number;
  }[];
  assumptions: { id: string; text: string }[];
  warnings: string[];
  propagationPaths: { componentId: string; path: string[] }[];
};

export function buildEvidencePacket(
  result: SimulationResult,
): EvidencePacket {
  const metricIds = result.metrics.map((m) => m.metricId);
  const refusedMetricIds = [
    ...new Set(result.refused.map((r) => r.metricId)),
  ].sort();
  const refusalCodes = [
    ...new Set(result.refused.map((r) => r.reasonCode)),
  ].sort();
  const componentIds = [
    ...new Set([
      ...result.impacts.map((i) => i.componentId),
      ...result.saturations.map((s) => s.componentId),
      ...result.propagationPaths.map((p) => p.componentId),
    ]),
  ].sort();

  return {
    status: result.status,
    metricIds: [...metricIds].sort(),
    refusedMetricIds,
    componentIds,
    refusalCodes,
    metrics: result.metrics.map((m) => ({
      metricId: m.metricId,
      value: m.value,
      unit: m.unit,
      formulaId: m.formulaId,
      substitutions: m.substitutions,
      result: m.result,
    })),
    refused: result.refused.map((r) => ({
      metricId: r.metricId,
      reasonCode: r.reasonCode,
      message: r.message,
    })),
    impacts: result.impacts.map((i) => ({
      componentId: i.componentId,
      impact: i.impact,
      path: i.path,
    })),
    saturations: result.saturations.map((s) => {
      const row: EvidencePacket['saturations'][number] = {
        componentId: s.componentId,
        saturated: s.saturated,
      };
      if (s.utilization !== undefined) {
        row.utilization = s.utilization;
      }
      if (s.offeredLoadRps !== undefined) {
        row.offeredLoadRps = s.offeredLoadRps;
      }
      if (s.capacityRps !== undefined) {
        row.capacityRps = s.capacityRps;
      }
      return row;
    }),
    assumptions: result.assumptions.map((a) => ({ id: a.id, text: a.text })),
    warnings: [...result.warnings],
    propagationPaths: result.propagationPaths.map((p) => ({
      componentId: p.componentId,
      path: p.path,
    })),
  };
}

/** Deterministic Markdown — numbers only from the packet. */
export function renderDeterministicExplanation(
  packet: EvidencePacket,
): string {
  const lines: string[] = [];
  lines.push(`## Simulation status: ${packet.status}`);
  lines.push('');
  lines.push('### Metrics (engine)');
  if (packet.metrics.length === 0) {
    lines.push('_No numerical metrics._');
  } else {
    for (const m of packet.metrics) {
      lines.push(
        `- \`${m.metricId}\` = **${m.value}** ${m.unit} (${m.formulaId}): ${m.result}`,
      );
      for (const s of m.substitutions) {
        lines.push(`  - ${s}`);
      }
    }
  }
  lines.push('');
  lines.push('### Refusals (engine)');
  for (const r of packet.refused) {
    lines.push(`- \`${r.metricId}\` [${r.reasonCode}]: ${r.message}`);
  }
  lines.push('');
  lines.push('### Impacts');
  for (const i of packet.impacts) {
    lines.push(
      `- \`${i.componentId}\`: ${i.impact}${i.path.length ? ` via [${i.path.join(' → ')}]` : ''}`,
    );
  }
  if (packet.saturations.length > 0) {
    lines.push('');
    lines.push('### Saturations');
    for (const s of packet.saturations) {
      lines.push(
        `- \`${s.componentId}\`: saturated=${s.saturated}` +
          (s.utilization !== undefined ? ` U=${s.utilization}` : '') +
          (s.offeredLoadRps !== undefined ? ` L=${s.offeredLoadRps}` : '') +
          (s.capacityRps !== undefined ? ` C=${s.capacityRps}` : ''),
      );
    }
  }
  if (packet.assumptions.length > 0) {
    lines.push('');
    lines.push('### Assumptions');
    for (const a of packet.assumptions) {
      lines.push(`- \`${a.id}\`: ${a.text}`);
    }
  }
  return lines.join('\n');
}
