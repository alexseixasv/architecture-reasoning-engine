import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { mapDomainErrorToHttp } from '../common/http-error.mapper';
import type { LlmConfig } from '../llm/config';
import { LLM_CONFIG } from '../llm/llm.tokens';
import { AnalysisService } from './analysis.service';

const extractBodySchema = z
  .object({
    architectureText: z.string().min(1),
  })
  .strict();

const analyzeBodySchema = z
  .object({
    question: z.string().min(1),
  })
  .strict();

@Controller()
export class AnalysisController {
  constructor(
    @Inject(AnalysisService) private readonly analysis: AnalysisService,
    @Inject(LLM_CONFIG) private readonly config: LlmConfig,
  ) {}

  @Post('architectures/extract')
  @HttpCode(200)
  async extract(@Body() body: unknown) {
    const parsed = extractBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        'Body must include non-empty architectureText',
      );
    }
    if (parsed.data.architectureText.length > this.config.maxArchitectureChars) {
      throw new BadRequestException({
        message: `Architecture description exceeds ${this.config.maxArchitectureChars} characters`,
        errorClass: 'INPUT_TOO_LARGE',
      });
    }
    try {
      return await this.analysis.extractFromText(parsed.data.architectureText);
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  @Post('architectures/:id/versions/:version/analyze')
  @HttpCode(200)
  async analyze(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: unknown,
  ) {
    const parsed = analyzeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Body must include non-empty question');
    }
    if (parsed.data.question.length > this.config.maxQuestionChars) {
      throw new BadRequestException({
        message: `Question exceeds ${this.config.maxQuestionChars} characters`,
        errorClass: 'INPUT_TOO_LARGE',
      });
    }
    try {
      return await this.analysis.analyzeVersion({
        architectureId: id,
        version,
        question: parsed.data.question,
      });
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }
}
