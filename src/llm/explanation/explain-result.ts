import type { SimulationResult } from '../../simulation/domain/result';
import type { LlmConfig } from '../config';
import { loadLlmConfig } from '../config';
import {
  EXPLANATION_SCHEMA_NAME,
  explanationDtoSchema,
  type ExplanationDto,
} from '../dto/explanation.dto';
import type { LlmErrorClass } from '../errors';
import type { LlmProvider } from '../provider/llm-provider';
import { EXPLANATION_SYSTEM_PROMPT } from '../prompts/explanation';
import { recordUsage } from '../usage/usage-recorder';
import {
  buildEvidencePacket,
  renderDeterministicExplanation,
  type EvidencePacket,
} from './render-evidence';
import { validateExplanationDto } from './validate-explanation';

export type ExplanationResult = {
  markdown: string;
  evidenceMarkdown: string;
  qualitative?: ExplanationDto;
  packet: EvidencePacket;
  source: 'llm+deterministic' | 'deterministic_fallback';
  validationErrors?: string[];
  errorClass?: LlmErrorClass;
};

function composeMarkdown(
  qualitative: ExplanationDto | undefined,
  evidenceMarkdown: string,
): string {
  const parts: string[] = [];
  if (qualitative) {
    parts.push(`## Summary`);
    parts.push(qualitative.summary);
    parts.push('');
    if (qualitative.statements.length > 0) {
      parts.push('## Qualitative notes');
      for (const s of qualitative.statements) {
        const refs = [
          ...s.metricIds.map((id) => `metric:${id}`),
          ...s.refusedMetricIds.map((id) => `refusedMetric:${id}`),
          ...s.componentIds.map((id) => `component:${id}`),
          ...s.refusalCodes.map((id) => `refusalCode:${id}`),
        ];
        parts.push(
          `- ${s.text}${refs.length ? ` _(refs: ${refs.join(', ')})_` : ''}`,
        );
      }
      parts.push('');
    }
  }
  parts.push(evidenceMarkdown);
  parts.push('');
  parts.push(
    '_Numerical values, units, and formulas above are rendered deterministically from the simulation engine._',
  );
  return parts.join('\n');
}

function buildTrustedCatalog(packet: EvidencePacket): unknown {
  return {
    status: packet.status,
    availableMetrics: packet.metrics.map((m) => ({
      metricId: m.metricId,
      unit: m.unit,
      formulaId: m.formulaId,
    })),
    refusedOutputs: packet.refused.map((r) => ({
      metricId: r.metricId,
      reasonCodes: [r.reasonCode],
    })),
    availableComponents: packet.componentIds,
    // Convenience flat lists matching DTO field names
    calculatedMetricIds: packet.metricIds,
    refusedMetricIds: packet.refusedMetricIds,
    refusalCodes: packet.refusalCodes,
    impacts: packet.impacts,
    assumptions: packet.assumptions,
  };
}

export async function explainSimulationResult(input: {
  result: SimulationResult;
  provider: LlmProvider;
  config?: LlmConfig;
}): Promise<ExplanationResult> {
  void (input.config ?? loadLlmConfig());
  const packet = buildEvidencePacket(input.result);
  const evidenceMarkdown = renderDeterministicExplanation(packet);

  const parsed = await input.provider.parseStructured({
    operation: 'explain',
    systemPrompt: EXPLANATION_SYSTEM_PROMPT,
    userContent: [
      'TRUSTED_EVIDENCE_PACKET_BEGIN',
      JSON.stringify(buildTrustedCatalog(packet)),
      'TRUSTED_EVIDENCE_PACKET_END',
    ].join('\n'),
    schema: explanationDtoSchema,
    schemaName: EXPLANATION_SCHEMA_NAME,
  });

  recordUsage({
    operation: 'explain',
    model: parsed.model,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    totalTokens: parsed.totalTokens,
    durationMs: parsed.durationMs,
    ...(parsed.providerRequestId
      ? { providerRequestId: parsed.providerRequestId }
      : {}),
    ...(!parsed.ok ? { errorClass: parsed.errorClass } : {}),
  });

  if (!parsed.ok) {
    return {
      markdown: composeMarkdown(undefined, evidenceMarkdown),
      evidenceMarkdown,
      packet,
      source: 'deterministic_fallback',
      errorClass: parsed.errorClass,
      validationErrors: [parsed.message],
    };
  }

  const validation = validateExplanationDto(parsed.data, packet);
  if (!validation.ok) {
    return {
      markdown: composeMarkdown(undefined, evidenceMarkdown),
      evidenceMarkdown,
      packet,
      source: 'deterministic_fallback',
      errorClass: 'EXPLANATION_INVALID',
      validationErrors: validation.reasons,
    };
  }

  return {
    markdown: composeMarkdown(parsed.data, evidenceMarkdown),
    evidenceMarkdown,
    qualitative: parsed.data,
    packet,
    source: 'llm+deterministic',
  };
}
