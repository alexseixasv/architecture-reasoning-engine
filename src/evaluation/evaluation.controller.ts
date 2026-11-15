import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { checkEvaluationLabGate } from './evaluation.gate';
import { EvaluationService } from './evaluation.service';
import { HistoricalEvidenceService } from './historical/historical.service';
import { isEvaluationSuiteId } from './types';

type RunBody = {
  suiteId?: unknown;
};

@Controller('evaluation')
export class EvaluationController {
  constructor(
    @Inject(EvaluationService)
    private readonly evaluation: EvaluationService,
    @Inject(HistoricalEvidenceService)
    private readonly historical: HistoricalEvidenceService,
  ) {}

  @Get('suites')
  listSuites() {
    this.assertEnabled();
    return this.evaluation.listSuites();
  }

  @Post('runs')
  @HttpCode(200)
  run(@Body() body: RunBody) {
    this.assertEnabled();
    const suiteId = body?.suiteId ?? 'deterministic_full';
    if (!isEvaluationSuiteId(suiteId)) {
      throw new BadRequestException({
        message: `Unsupported suiteId. Allowlisted: deterministic_full, golden, validation_formal, adversarial`,
        errorClass: 'INVALID_SUITE_ID',
        suiteId,
      });
    }
    return this.evaluation.runSuite(suiteId);
  }

  @Get('historical')
  getHistorical() {
    this.assertEnabled();
    return this.historical.getHistorical();
  }

  private assertEnabled(): void {
    const gate = checkEvaluationLabGate();
    if (!gate.ok) {
      throw new ForbiddenException({
        message: gate.message,
        code: gate.code,
      });
    }
  }
}
