import { describe, expect, it } from 'vitest';
import { loadLlmConfig, requireOpenAiKey } from '../../../src/llm/config';
import { LlmError } from '../../../src/llm/errors';
import { sanitizeForLog } from '../../../src/llm/errors';
import { OpenAiLlmProvider } from '../../../src/llm/provider/openai-llm-provider';

describe('OpenAI config safety', () => {
  it('loads OPENAI_* exclusively from env and defaults model to gpt-4.1', () => {
    const cfg = loadLlmConfig({
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test-not-real',
      OPENAI_MODEL: 'gpt-4.1',
      OPENAI_TIMEOUT_MS: '45000',
    } as NodeJS.ProcessEnv);
    expect(cfg.provider).toBe('openai');
    expect(cfg.openaiModel).toBe('gpt-4.1');
    expect(cfg.openaiTimeoutMs).toBe(45000);
    expect(cfg.openaiApiKey).toBe('sk-test-not-real');
  });

  it('fails safely when API key is missing', () => {
    const cfg = loadLlmConfig({
      LLM_PROVIDER: 'openai',
    } as NodeJS.ProcessEnv);
    expect(() => requireOpenAiKey(cfg)).toThrow(LlmError);
    expect(() => new OpenAiLlmProvider(cfg)).toThrow(LlmError);
  });

  it('redacts secrets in sanitizeForLog', () => {
    const raw =
      'Bearer sk-abc123SECRET Authorization: Bearer tok and api_key=sk-xyz';
    const cleaned = sanitizeForLog(raw);
    expect(cleaned).not.toContain('sk-abc123SECRET');
    expect(cleaned).not.toContain('sk-xyz');
    expect(cleaned).toContain('[REDACTED');
  });
});
