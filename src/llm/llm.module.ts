import { Global, Module } from '@nestjs/common';
import { loadLlmConfig, type LlmConfig } from './config';
import { createLlmProvider } from './provider/create-provider';
import type { LlmProvider } from './provider/llm-provider';
import { LLM_CONFIG, LLM_PROVIDER } from './llm.tokens';

@Global()
@Module({
  providers: [
    {
      provide: LLM_CONFIG,
      useFactory: (): LlmConfig => loadLlmConfig(),
    },
    {
      provide: LLM_PROVIDER,
      useFactory: (config: LlmConfig): LlmProvider => createLlmProvider(config),
      inject: [LLM_CONFIG],
    },
  ],
  exports: [LLM_CONFIG, LLM_PROVIDER],
})
export class LlmModule {}
