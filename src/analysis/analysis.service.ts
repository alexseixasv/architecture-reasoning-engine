import { Inject, Injectable, Logger } from '@nestjs/common';
import { ArchitectureService } from '../architecture/application/architecture.service';
import { completenessGaps } from '../architecture/domain/completeness';
import {
  isProviderInfrastructureError,
  throwForLlmFailure,
} from '../common/http-error.mapper';
import type { LlmConfig } from '../llm/config';
import { sanitizeForLog } from '../llm/errors';
import { explainSimulationResult } from '../llm/explanation/explain-result';
import { extractArchitecture } from '../llm/extraction/extract-architecture';
import { extractScenario } from '../llm/extraction/extract-scenario';
import { LLM_CONFIG, LLM_PROVIDER } from '../llm/llm.tokens';
import type { LlmProvider } from '../llm/provider/llm-provider';
import { UsageCollector, type UsageSummary } from '../llm/usage/usage-collector';
import type { SimulationResult } from '../simulation/domain/result';
import { simulate } from '../simulation/simulate';

export type ExtractHttpResponse = {
  status: 'PROPOSED' | 'EXTRACTION_FAILED';
  document: unknown | null;
  findings: unknown[];
  gaps: unknown[];
  clarificationQuestions: string[];
  notes: string[];
  canPersist: boolean;
  usage: UsageSummary;
  errorClass: string | null;
  message?: string;
};

export type AnalyzeHttpResponse = {
  architectureId: string;
  architectureVersion: number;
  scenarioExtraction: {
    status: 'OK' | 'NEEDS_CLARIFICATION' | 'UNSUPPORTED' | 'FAILED';
    scenario: unknown | null;
    reason: string | null;
    clarificationQuestions: string[];
    errorClass?: string;
    message?: string;
  };
  simulation: SimulationResult | null;
  explanation: {
    source: 'llm+deterministic' | 'deterministic_fallback';
    markdown: string;
    evidenceMarkdown: string;
    qualitative?: unknown;
    validationErrors?: string[];
    errorClass?: string;
  } | null;
  usage: UsageSummary;
  timingsMs: {
    extractScenario: number;
    simulate: number;
    explain: number;
    total: number;
  };
};

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(ArchitectureService)
    private readonly architectures: ArchitectureService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    @Inject(LLM_CONFIG) private readonly config: LlmConfig,
  ) {}

  async extractFromText(architectureText: string): Promise<ExtractHttpResponse> {
    const usage = new UsageCollector();
    const started = Date.now();

    this.logger.log(
      JSON.stringify({
        msg: 'extract_started',
        textChars: architectureText.length,
        provider: this.provider.name,
      }),
    );

    const result = await extractArchitecture({
      architectureText,
      provider: this.provider,
      config: this.config,
      usage,
    });

    if (result.status === 'EXTRACTION_FAILED') {
      this.logger.warn(
        JSON.stringify({
          msg: 'extract_failed',
          errorClass: result.errorClass,
          durationMs: Date.now() - started,
          message: sanitizeForLog(result.message),
        }),
      );
      if (
        result.errorClass === 'INPUT_TOO_LARGE' ||
        isProviderInfrastructureError(result.errorClass)
      ) {
        throwForLlmFailure(result.errorClass, result.message);
      }
      return {
        status: 'EXTRACTION_FAILED',
        document: null,
        findings: result.findings,
        gaps: [],
        clarificationQuestions: [],
        notes: [],
        canPersist: false,
        usage: usage.summary(),
        errorClass: result.errorClass,
        message: sanitizeForLog(result.message),
      };
    }

    const gaps = completenessGaps(result.document);
    this.logger.log(
      JSON.stringify({
        msg: 'extract_completed',
        status: 'PROPOSED',
        canPersist: result.canPersist,
        findings: result.findings.length,
        durationMs: Date.now() - started,
      }),
    );

    return {
      status: 'PROPOSED',
      document: result.document,
      findings: result.findings,
      gaps,
      clarificationQuestions: result.clarificationQuestions,
      notes: result.notes,
      canPersist: result.canPersist,
      usage: usage.summary(),
      errorClass: null,
    };
  }

  async analyzeVersion(input: {
    architectureId: string;
    version: number;
    question: string;
  }): Promise<AnalyzeHttpResponse> {
    const usage = new UsageCollector();
    const totalStarted = Date.now();
    const timingsMs = {
      extractScenario: 0,
      simulate: 0,
      explain: 0,
      total: 0,
    };

    const stored = await this.architectures.getVersion(
      input.architectureId,
      input.version,
    );

    this.logger.log(
      JSON.stringify({
        msg: 'analyze_started',
        architectureId: input.architectureId,
        architectureVersion: input.version,
        questionChars: input.question.length,
        provider: this.provider.name,
      }),
    );

    const scenarioStarted = Date.now();
    const scenarioResult = await extractScenario({
      question: input.question,
      architecture: stored.document,
      provider: this.provider,
      config: this.config,
      usage,
    });
    timingsMs.extractScenario = Date.now() - scenarioStarted;

    if (scenarioResult.status === 'FAILED') {
      this.logger.warn(
        JSON.stringify({
          msg: 'analyze_scenario_failed',
          errorClass: scenarioResult.errorClass,
          message: sanitizeForLog(scenarioResult.message),
        }),
      );
      if (
        scenarioResult.errorClass === 'INPUT_TOO_LARGE' ||
        isProviderInfrastructureError(scenarioResult.errorClass)
      ) {
        throwForLlmFailure(scenarioResult.errorClass, scenarioResult.message);
      }
      timingsMs.total = Date.now() - totalStarted;
      return {
        architectureId: input.architectureId,
        architectureVersion: input.version,
        scenarioExtraction: {
          status: 'FAILED',
          scenario: null,
          reason: null,
          clarificationQuestions: [],
          errorClass: scenarioResult.errorClass,
          message: sanitizeForLog(scenarioResult.message),
        },
        simulation: null,
        explanation: null,
        usage: usage.summary(),
        timingsMs,
      };
    }

    if (scenarioResult.status === 'NEEDS_CLARIFICATION') {
      timingsMs.total = Date.now() - totalStarted;
      return {
        architectureId: input.architectureId,
        architectureVersion: input.version,
        scenarioExtraction: {
          status: 'NEEDS_CLARIFICATION',
          scenario: null,
          reason: scenarioResult.reason,
          clarificationQuestions: scenarioResult.clarificationQuestions,
        },
        simulation: null,
        explanation: null,
        usage: usage.summary(),
        timingsMs,
      };
    }

    if (scenarioResult.status === 'UNSUPPORTED') {
      timingsMs.total = Date.now() - totalStarted;
      return {
        architectureId: input.architectureId,
        architectureVersion: input.version,
        scenarioExtraction: {
          status: 'UNSUPPORTED',
          scenario: null,
          reason: scenarioResult.reason,
          clarificationQuestions: [],
        },
        simulation: null,
        explanation: null,
        usage: usage.summary(),
        timingsMs,
      };
    }

    const simStarted = Date.now();
    const simulation = simulate(stored.document, scenarioResult.scenario);
    timingsMs.simulate = Date.now() - simStarted;

    const explainStarted = Date.now();
    const explained = await explainSimulationResult({
      result: simulation,
      provider: this.provider,
      config: this.config,
      usage,
    });
    timingsMs.explain = Date.now() - explainStarted;
    timingsMs.total = Date.now() - totalStarted;

    this.logger.log(
      JSON.stringify({
        msg: 'analyze_completed',
        architectureId: input.architectureId,
        architectureVersion: input.version,
        scenarioStatus: 'OK',
        simulationStatus: simulation.status,
        explanationSource: explained.source,
        timingsMs,
      }),
    );

    return {
      architectureId: input.architectureId,
      architectureVersion: input.version,
      scenarioExtraction: {
        status: 'OK',
        scenario: scenarioResult.scenario,
        reason: null,
        clarificationQuestions: [],
      },
      simulation,
      explanation: {
        source: explained.source,
        markdown: explained.markdown,
        evidenceMarkdown: explained.evidenceMarkdown,
        ...(explained.qualitative !== undefined
          ? { qualitative: explained.qualitative }
          : {}),
        ...(explained.validationErrors !== undefined
          ? { validationErrors: explained.validationErrors }
          : {}),
        ...(explained.errorClass !== undefined
          ? { errorClass: explained.errorClass }
          : {}),
      },
      usage: usage.summary(),
      timingsMs,
    };
  }
}
