import type { z } from 'zod';
import type { LlmOperation } from '../usage/usage-recorder';

export type StructuredParseRequest<T extends z.ZodType> = {
  operation: LlmOperation;
  systemPrompt: string;
  /** Untrusted user content — already delimited by callers. */
  userContent: string;
  schema: T;
  schemaName: string;
};

export type StructuredParseSuccess<T> = {
  ok: true;
  data: T;
  model: string;
  providerRequestId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
};

export type StructuredParseFailure = {
  ok: false;
  errorClass: import('../errors').LlmErrorClass;
  message: string;
  model: string;
  providerRequestId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
};

export type StructuredParseResult<T> =
  | StructuredParseSuccess<T>
  | StructuredParseFailure;

export interface LlmProvider {
  readonly name: string;
  parseStructured<T extends z.ZodType>(
    request: StructuredParseRequest<T>,
  ): Promise<StructuredParseResult<z.infer<T>>>;
}
