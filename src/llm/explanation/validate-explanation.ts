import type { ExplanationDto } from '../dto/explanation.dto';
import type { EvidencePacket } from './render-evidence';

export type ExplanationValidation =
  | { ok: true }
  | { ok: false; reasons: string[] };

const UNSUPPORTED_TEXT_PATTERNS: { id: string; re: RegExp }[] = [
  {
    id: 'proven_outage',
    re: /\b(will be|is definitely|guaranteed)\s+(down|unavailable|out)\b/i,
  },
  {
    id: 'invented_availability',
    re: /\b(availability|uptime)\s*(=|is|:)?\s*\d+(\.\d+)?\s*%/i,
  },
  {
    id: 'invented_percentile',
    re: /\b(p95|p99)\s*(=|is|:|of)?\s*\d+/i,
  },
  {
    id: 'attempt_rate_as_throughput',
    re: /\b(attempt[- ]?rate|attempts\/s)\b.*\b(throughput|successful rps)\b/i,
  },
  {
    id: 'invented_numeric_result',
    re: /\d/,
  },
];

function textHasUnsupportedClaim(
  text: string,
): { id: string } | undefined {
  for (const pat of UNSUPPORTED_TEXT_PATTERNS) {
    if (pat.id === 'invented_numeric_result') {
      const stripped = text
        .replace(/\b[a-z][a-z0-9_]*:[a-z0-9_.:-]+\b/gi, '')
        .replace(/\bF-[A-Z]+-\d+\b/g, '')
        .replace(/\bp95\b|\bp99\b/gi, '');
      if (pat.re.test(stripped)) {
        return { id: pat.id };
      }
      continue;
    }
    if (pat.re.test(text)) {
      return { id: pat.id };
    }
  }
  return undefined;
}

/**
 * Validates structural references and constrained claim kinds.
 * Calculated metricIds and refusedMetricIds are disjoint roles.
 */
export function validateExplanationDto(
  dto: ExplanationDto,
  packet: EvidencePacket,
): ExplanationValidation {
  const reasons: string[] = [];
  const metricSet = new Set(packet.metricIds);
  const refusedMetricSet = new Set(packet.refusedMetricIds);
  const componentSet = new Set(packet.componentIds);
  const refusalCodeSet = new Set(packet.refusalCodes);

  if (dto.acknowledgedStatus !== packet.status) {
    reasons.push(
      `acknowledgedStatus ${dto.acknowledgedStatus} != engine status ${packet.status}`,
    );
  }

  const summaryBad = textHasUnsupportedClaim(dto.summary);
  if (summaryBad) {
    reasons.push(`unsupported qualitative claim (${summaryBad.id}) in summary`);
  }

  for (const [si, stmt] of dto.statements.entries()) {
    for (const id of stmt.metricIds) {
      if (refusedMetricSet.has(id)) {
        reasons.push(
          `statement[${si}] refused metric "${id}" presented as calculated metricId`,
        );
      } else if (!metricSet.has(id)) {
        reasons.push(`statement[${si}] unknown metricId "${id}"`);
      }
    }
    for (const id of stmt.refusedMetricIds) {
      if (!refusedMetricSet.has(id)) {
        reasons.push(`statement[${si}] unknown refusedMetricId "${id}"`);
      }
    }
    for (const id of stmt.componentIds) {
      if (!componentSet.has(id)) {
        reasons.push(`statement[${si}] unknown componentId "${id}"`);
      }
    }
    for (const code of stmt.refusalCodes) {
      if (!refusalCodeSet.has(code)) {
        reasons.push(`statement[${si}] unknown refusalCode "${code}"`);
      }
    }

    if (
      stmt.claimKind !== 'general' &&
      stmt.metricIds.length === 0 &&
      stmt.refusedMetricIds.length === 0 &&
      stmt.componentIds.length === 0 &&
      stmt.refusalCodes.length === 0
    ) {
      reasons.push(
        `statement[${si}] claimKind=${stmt.claimKind} requires at least one evidence reference`,
      );
    }

    const bad = textHasUnsupportedClaim(stmt.text);
    if (bad) {
      reasons.push(
        `statement[${si}] unsupported qualitative claim (${bad.id})`,
      );
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons: [...new Set(reasons)] };
  }
  return { ok: true };
}
