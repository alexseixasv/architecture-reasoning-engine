import { Module } from '@nestjs/common';
import { ArchitectureModule } from './architecture/presentation/architecture.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, ArchitectureModule],
})
export class AppModule {}
