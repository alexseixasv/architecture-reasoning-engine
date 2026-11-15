import { Module } from '@nestjs/common';
import { AnalysisModule } from './analysis/analysis.module';
import { ArchitectureModule } from './architecture/presentation/architecture.module';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [HealthModule, LlmModule, ArchitectureModule, AnalysisModule],
})
export class AppModule {}
