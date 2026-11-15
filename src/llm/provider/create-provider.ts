import type { LlmConfig } from '../config';
import { loadLlmConfig } from '../config';
import { FakeLlmProvider } from './fake-llm-provider';
import type { LlmProvider } from './llm-provider';
import { OpenAiLlmProvider } from './openai-llm-provider';

export function createLlmProvider(
  config: LlmConfig = loadLlmConfig(),
): LlmProvider {
  if (config.provider === 'openai') {
    return new OpenAiLlmProvider(config);
  }
  return new FakeLlmProvider();
}
