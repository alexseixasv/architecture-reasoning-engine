import { Module } from '@nestjs/common';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { HistoricalEvidenceService } from './historical/historical.service';

@Module({
  controllers: [EvaluationController],
  providers: [EvaluationService, HistoricalEvidenceService],
})
export class EvaluationModule {}
