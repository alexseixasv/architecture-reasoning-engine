import type { LlmConfig } from '../config';
import { loadLlmConfig } from '../config';
import { installFakeDemoHandlers } from './fake-demo-handlers';
import { FakeLlmProvider } from './fake-llm-provider';
import type { LlmProvider } from './llm-provider';
import { OpenAiLlmProvider } from './openai-llm-provider';

/**
 * Factory for Nest/Compose/scripts.
 * Fake instances created here install demo handlers so Compose HTTP works
 * without OpenAI. Tests that need fail-closed Fake use `new FakeLlmProvider()`.
 */
export function createLlmProvider(
  config: LlmConfig = loadLlmConfig(),
): LlmProvider {
  if (config.provider === 'openai') {
    return new OpenAiLlmProvider(config);
  }
  const fake = new FakeLlmProvider();
  installFakeDemoHandlers(fake);
  return fake;
}
