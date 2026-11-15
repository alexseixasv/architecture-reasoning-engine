import { validateArchitectureDocument } from '../../architecture/application/validate';
import type {
  ArchitectureDocument,
  ValidationFinding,
} from '../../architecture/domain/types';
import type { LlmConfig } from '../config';
import { loadLlmConfig } from '../config';
import {
  ARCHITECTURE_EXTRACTION_SCHEMA_NAME,
  architectureExtractionDtoSchema,
} from '../dto/architecture-extraction.dto';
import { LlmError } from '../errors';
import { mapExtractionToArchitectureDocument } from '../mapping/to-architecture-document';
import type { LlmProvider } from '../provider/llm-provider';
import {
  ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT,
  wrapUntrustedArchitecture,
} from '../prompts/architecture';
import type { UsageCollector } from '../usage/usage-collector';
import { recordUsage } from '../usage/usage-recorder';

export type ArchitectureExtractionResult =
  | {
      status: 'PROPOSED';
      document: ArchitectureDocument;
      findings: ValidationFinding[];
      clarificationQuestions: string[];
      notes: string[];
      canPersist: boolean;
    }
  | {
      status: 'EXTRACTION_FAILED';
      errorClass: LlmError['errorClass'];
      message: string;
      findings: ValidationFinding[];
    };

export async function extractArchitecture(input: {
  architectureText: string;
  provider: LlmProvider;
  config?: LlmConfig;
  usage?: UsageCollector;
}): Promise<ArchitectureExtractionResult> {
  const config = input.config ?? loadLlmConfig();
  const text = input.architectureText;

  if (text.length > config.maxArchitectureChars) {
    return {
      status: 'EXTRACTION_FAILED',
      errorClass: 'INPUT_TOO_LARGE',
      message: `Architecture description exceeds ${config.maxArchitectureChars} characters`,
      findings: [],
    };
  }

  const parsed = await input.provider.parseStructured({
    operation: 'extract_architecture',
    systemPrompt: ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT,
    userContent: wrapUntrustedArchitecture(text),
    schema: architectureExtractionDtoSchema,
    schemaName: ARCHITECTURE_EXTRACTION_SCHEMA_NAME,
  });

  recordUsage(
    {
      operation: 'extract_architecture',
      model: parsed.model,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      totalTokens: parsed.totalTokens,
      durationMs: parsed.durationMs,
      ...(parsed.providerRequestId
        ? { providerRequestId: parsed.providerRequestId }
        : {}),
      ...(!parsed.ok ? { errorClass: parsed.errorClass } : {}),
    },
    input.usage,
  );

  if (!parsed.ok) {
    return {
      status: 'EXTRACTION_FAILED',
      errorClass: parsed.errorClass,
      message: parsed.message,
      findings: [],
    };
  }

  const mapped = mapExtractionToArchitectureDocument(parsed.data, text);
  const validation = validateArchitectureDocument(mapped.document);
  const findings = [...mapped.findings, ...validation.findings];

  return {
    status: 'PROPOSED',
    document: validation.document ?? mapped.document,
    findings,
    clarificationQuestions: parsed.data.clarificationQuestions,
    notes: parsed.data.notes,
    canPersist: validation.canPersist,
  };
}
