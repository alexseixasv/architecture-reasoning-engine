import { Module } from '@nestjs/common';
import { ArchitectureModule } from '../architecture/presentation/architecture.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [ArchitectureModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
