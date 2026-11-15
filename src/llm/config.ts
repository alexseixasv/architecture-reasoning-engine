import { LlmError } from './errors';

export type LlmProviderName = 'openai' | 'fake';

export type LlmConfig = {
  provider: LlmProviderName;
  openaiApiKey?: string;
  openaiModel: string;
  openaiTimeoutMs: number;
  maxArchitectureChars: number;
  maxQuestionChars: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

export function loadLlmConfig(
  env: NodeJS.ProcessEnv = process.env,
): LlmConfig {
  const providerRaw = (env['LLM_PROVIDER'] ?? 'fake').toLowerCase();
  const provider: LlmProviderName =
    providerRaw === 'openai' ? 'openai' : 'fake';

  const config: LlmConfig = {
    provider,
    openaiModel: env['OPENAI_MODEL']?.trim() || 'gpt-4.1',
    openaiTimeoutMs: parsePositiveInt(env['OPENAI_TIMEOUT_MS'], 60_000),
    maxArchitectureChars: parsePositiveInt(
      env['LLM_MAX_ARCHITECTURE_CHARS'],
      20_000,
    ),
    maxQuestionChars: parsePositiveInt(env['LLM_MAX_QUESTION_CHARS'], 4_000),
  };

  const key = env['OPENAI_API_KEY']?.trim();
  if (key) {
    config.openaiApiKey = key;
  }

  return config;
}

export function requireOpenAiKey(config: LlmConfig): string {
  if (!config.openaiApiKey) {
    throw new LlmError(
      'PROVIDER_CONFIG_ERROR',
      'OPENAI_API_KEY is missing; cannot use LLM_PROVIDER=openai',
    );
  }
  return config.openaiApiKey;
}
