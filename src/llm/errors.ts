export type LlmErrorClass =
  | 'PROVIDER_CONFIG_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_INCOMPLETE'
  | 'MODEL_REFUSAL'
  | 'SCHEMA_MISMATCH'
  | 'UNSUPPORTED_SCENARIO'
  | 'NEEDS_CLARIFICATION'
  | 'PROVENANCE_UNVERIFIED'
  | 'EXPLANATION_INVALID'
  | 'INPUT_TOO_LARGE'
  | 'INTERNAL_ERROR';

export class LlmError extends Error {
  readonly errorClass: LlmErrorClass;
  readonly details?: Record<string, unknown>;

  constructor(
    errorClass: LlmErrorClass,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'LlmError';
    this.errorClass = errorClass;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

/** Never log secrets; strip Authorization / sk- patterns from diagnostic strings. */
export function sanitizeForLog(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"'\s]+/gi, 'api_key=[REDACTED]');
}
