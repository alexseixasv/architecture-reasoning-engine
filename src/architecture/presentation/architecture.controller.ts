import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ArchitectureService } from '../application/architecture.service';
import {
  changeSourceSchema,
  DEFAULT_CHANGE_SOURCE,
} from '../../common/change-source';
import { mapDomainErrorToHttp } from '../../common/http-error.mapper';

type CreateBody = {
  document: unknown;
  changeSource?: unknown;
};

type UpdateBody = {
  expectedVersion: number;
  document: unknown;
  changeSource?: unknown;
};

@Controller('architectures')
export class ArchitectureController {
  constructor(
    @Inject(ArchitectureService)
    private readonly service: ArchitectureService,
  ) {}

  @Post('validate')
  @HttpCode(200)
  validate(@Body() body: CreateBody) {
    if (body === null || typeof body !== 'object' || !('document' in body)) {
      throw new BadRequestException('Body must include document');
    }
    return this.service.validate(body.document);
  }

  @Post()
  async create(@Body() body: CreateBody) {
    if (body === null || typeof body !== 'object' || !('document' in body)) {
      throw new BadRequestException('Body must include document');
    }
    const changeSource = this.parseChangeSource(body.changeSource);
    try {
      const stored = await this.service.create(body.document, changeSource);
      return this.toEnvelope(stored);
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  @Get(':id')
  async getLatest(@Param('id') id: string) {
    try {
      const stored = await this.service.getLatest(id);
      return this.toEnvelope(stored);
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    try {
      return {
        architectureId: id,
        versions: await this.service.listVersions(id),
      };
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  @Get(':id/versions/:version')
  async getVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    try {
      const stored = await this.service.getVersion(id, version);
      return this.toEnvelope(stored);
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateBody) {
    if (
      body === null ||
      typeof body !== 'object' ||
      typeof body.expectedVersion !== 'number' ||
      !Number.isInteger(body.expectedVersion)
    ) {
      throw new BadRequestException(
        'Body must include integer expectedVersion and document',
      );
    }
    const changeSource = this.parseChangeSource(body.changeSource);
    try {
      const stored = await this.service.update(
        id,
        body.expectedVersion,
        body.document,
        changeSource,
      );
      return this.toEnvelope(stored);
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  @Get(':id/diff')
  async diff(
    @Param('id') id: string,
    @Query('from', ParseIntPipe) from: number,
    @Query('to', ParseIntPipe) to: number,
  ) {
    try {
      return await this.service.diff(id, from, to);
    } catch (error) {
      mapDomainErrorToHttp(error);
    }
  }

  private parseChangeSource(raw: unknown): string {
    if (raw === undefined || raw === null) {
      return DEFAULT_CHANGE_SOURCE;
    }
    const parsed = changeSourceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(
        'changeSource must be one of: manual, user_corrected, approved_extraction',
      );
    }
    return parsed.data;
  }

  private toEnvelope(
    stored: Awaited<ReturnType<ArchitectureService['getLatest']>>,
  ) {
    return {
      architectureId: stored.architectureId,
      version: stored.version,
      schemaVersion: stored.document.schemaVersion,
      document: stored.document,
      findings: stored.findings,
      changeSource: stored.changeSource,
      createdAt: stored.createdAt.toISOString(),
    };
  }
}
