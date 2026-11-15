import type { ArchitectureDocument } from '../../architecture/domain/types';
import type { Scenario } from '../../simulation/domain/scenario';
import type { LlmConfig } from '../config';
import { loadLlmConfig } from '../config';
import {
  SCENARIO_EXTRACTION_SCHEMA_NAME,
  scenarioExtractionDtoSchema,
} from '../dto/scenario-extraction.dto';
import type { LlmErrorClass } from '../errors';
import { mapExtractionToScenario } from '../mapping/to-scenario';
import type { LlmProvider } from '../provider/llm-provider';
import {
  SCENARIO_EXTRACTION_SYSTEM_PROMPT,
  wrapUntrustedQuestion,
} from '../prompts/scenario';
import { recordUsage } from '../usage/usage-recorder';

export type ScenarioExtractionResult =
  | { status: 'OK'; scenario: Scenario }
  | {
      status: 'UNSUPPORTED';
      reason: string;
    }
  | {
      status: 'NEEDS_CLARIFICATION';
      reason: string;
      clarificationQuestions: string[];
    }
  | {
      status: 'FAILED';
      errorClass: LlmErrorClass;
      message: string;
    };

export async function extractScenario(input: {
  question: string;
  architecture: ArchitectureDocument;
  provider: LlmProvider;
  config?: LlmConfig;
}): Promise<ScenarioExtractionResult> {
  const config = input.config ?? loadLlmConfig();
  if (input.question.length > config.maxQuestionChars) {
    return {
      status: 'FAILED',
      errorClass: 'INPUT_TOO_LARGE',
      message: `Question exceeds ${config.maxQuestionChars} characters`,
    };
  }

  const nodes = input.architecture.nodes.map((n) => ({
    id: n.id,
    name: n.name,
  }));

  const parsed = await input.provider.parseStructured({
    operation: 'extract_scenario',
    systemPrompt: SCENARIO_EXTRACTION_SYSTEM_PROMPT,
    userContent: wrapUntrustedQuestion(input.question, nodes),
    schema: scenarioExtractionDtoSchema,
    schemaName: SCENARIO_EXTRACTION_SCHEMA_NAME,
  });

  recordUsage({
    operation: 'extract_scenario',
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
      status: 'FAILED',
      errorClass: parsed.errorClass,
      message: parsed.message,
    };
  }

  const mapped = mapExtractionToScenario(parsed.data, input.architecture);
  if (mapped.status === 'ok') {
    return { status: 'OK', scenario: mapped.scenario };
  }
  if (mapped.status === 'unsupported') {
    return { status: 'UNSUPPORTED', reason: mapped.reason };
  }
  if (mapped.status === 'needs_clarification') {
    return {
      status: 'NEEDS_CLARIFICATION',
      reason: mapped.reason,
      clarificationQuestions: mapped.clarificationQuestions,
    };
  }
  return {
    status: 'FAILED',
    errorClass: 'SCHEMA_MISMATCH',
    message: mapped.reason,
  };
}
