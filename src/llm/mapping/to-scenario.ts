import { scenarioSchema, type Scenario } from '../../simulation/domain/scenario';
import type { ArchitectureDocument } from '../../architecture/domain/types';
import type { ScenarioExtractionDto } from '../dto/scenario-extraction.dto';
import {
  isMissingScenarioNumeric,
  SCENARIO_MISSING_NUMERIC,
} from '../dto/scenario-missing';
import { LlmError } from '../errors';

export type ScenarioMapResult =
  | { status: 'ok'; scenario: Scenario }
  | {
      status: 'unsupported';
      reason: string;
    }
  | {
      status: 'needs_clarification';
      reason: string;
      clarificationQuestions: string[];
    }
  | {
      status: 'invalid';
      reason: string;
    };

function resolveComponentRef(
  document: ArchitectureDocument,
  componentId: string,
): { ok: true; id: string } | { ok: false; reason: string } {
  const trimmed = componentId.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Empty component reference' };
  }

  const byId = document.nodes.filter((n) => n.id === trimmed);
  if (byId.length === 1) {
    return { ok: true, id: byId[0]!.id };
  }

  const lower = trimmed.toLowerCase();
  const byName = document.nodes.filter(
    (n) => n.name.toLowerCase() === lower || n.id.toLowerCase() === lower,
  );
  if (byName.length === 1) {
    return { ok: true, id: byName[0]!.id };
  }
  if (byName.length > 1) {
    return {
      ok: false,
      reason: `Ambiguous component reference "${trimmed}" matches: ${byName.map((n) => n.id).join(', ')}`,
    };
  }
  return {
    ok: false,
    reason: `Unknown component reference "${trimmed}"`,
  };
}

/**
 * Resolve a required positive/non-negative numeric from the DTO.
 * -1 is the only missing placeholder; other negatives are invalid DTO abuse.
 */
function requirePresentNumber(
  value: number,
  field: 'latencyMs' | 'multiplier',
  clarificationQuestions: string[],
  ask: string,
): ScenarioMapResult | { status: 'present'; value: number } {
  if (isMissingScenarioNumeric(value)) {
    return {
      status: 'needs_clarification',
      reason: `${field} missing (DTO sentinel ${SCENARIO_MISSING_NUMERIC}); cannot invent a value`,
      clarificationQuestions: [...clarificationQuestions, ask],
    };
  }
  if (value < 0) {
    return {
      status: 'invalid',
      reason: `${field}=${value} is not a valid scenario parameter (only ${SCENARIO_MISSING_NUMERIC} means missing)`,
    };
  }
  if (field === 'multiplier' && value === 0) {
    return {
      status: 'invalid',
      reason: 'multiplier must be > 0',
    };
  }
  return { status: 'present', value };
}

export function mapExtractionToScenario(
  dto: ScenarioExtractionDto,
  document: ArchitectureDocument,
): ScenarioMapResult {
  if (dto.outcome === 'unsupported') {
    return {
      status: 'unsupported',
      reason: dto.reason || 'Unsupported scenario intent',
    };
  }

  if (dto.outcome === 'needs_clarification') {
    return {
      status: 'needs_clarification',
      reason: dto.reason || 'Clarification required',
      clarificationQuestions: dto.clarificationQuestions,
    };
  }

  if (dto.outcome === 'component_unavailable') {
    const resolved = resolveComponentRef(document, dto.componentId);
    if (!resolved.ok) {
      if (resolved.reason.startsWith('Ambiguous')) {
        return {
          status: 'needs_clarification',
          reason: resolved.reason,
          clarificationQuestions: [
            ...dto.clarificationQuestions,
            `Which component did you mean? ${resolved.reason}`,
          ],
        };
      }
      return { status: 'invalid', reason: resolved.reason };
    }
    const candidate = {
      type: 'component_unavailable' as const,
      componentId: resolved.id,
    };
    const parsed = scenarioSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: 'invalid', reason: parsed.error.message };
    }
    return { status: 'ok', scenario: parsed.data };
  }

  if (dto.outcome === 'latency_degradation') {
    const num = requirePresentNumber(
      dto.latencyMs,
      'latencyMs',
      dto.clarificationQuestions,
      'What absolute latency in milliseconds should be applied?',
    );
    if (num.status !== 'present') {
      return num;
    }
    const resolved = resolveComponentRef(document, dto.componentId);
    if (!resolved.ok) {
      if (resolved.reason.startsWith('Ambiguous')) {
        return {
          status: 'needs_clarification',
          reason: resolved.reason,
          clarificationQuestions: [
            ...dto.clarificationQuestions,
            `Which component did you mean? ${resolved.reason}`,
          ],
        };
      }
      return { status: 'invalid', reason: resolved.reason };
    }
    // Never pass SCENARIO_MISSING_NUMERIC into the domain scenario.
    const candidate = {
      type: 'latency_degradation' as const,
      componentId: resolved.id,
      latencyMs: num.value,
    };
    const parsed = scenarioSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: 'invalid', reason: parsed.error.message };
    }
    return { status: 'ok', scenario: parsed.data };
  }

  if (dto.outcome === 'load_multiplication') {
    const num = requirePresentNumber(
      dto.multiplier,
      'multiplier',
      dto.clarificationQuestions,
      'What load multiplier should be applied?',
    );
    if (num.status !== 'present') {
      return num;
    }
    const candidate = {
      type: 'load_multiplication' as const,
      multiplier: num.value,
    };
    const parsed = scenarioSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: 'invalid', reason: parsed.error.message };
    }
    return { status: 'ok', scenario: parsed.data };
  }

  throw new LlmError(
    'INTERNAL_ERROR',
    `Unhandled scenario outcome: ${(dto as ScenarioExtractionDto).outcome}`,
  );
}
