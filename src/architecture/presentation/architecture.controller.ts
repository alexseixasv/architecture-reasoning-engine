import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ArchitectureService,
  PersistRejectedError,
} from '../application/architecture.service';
import {
  ArchitectureNotFoundError,
  ArchitectureVersionNotFoundError,
  VersionConflictError,
} from '../infrastructure/architecture.repository';

type CreateBody = {
  document: unknown;
};

type UpdateBody = {
  expectedVersion: number;
  document: unknown;
};

@Controller('architectures')
export class ArchitectureController {
  constructor(private readonly service: ArchitectureService) {}

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
    try {
      const stored = await this.service.create(body.document);
      return this.toEnvelope(stored);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get(':id')
  async getLatest(@Param('id') id: string) {
    try {
      const stored = await this.service.getLatest(id);
      return this.toEnvelope(stored);
    } catch (error) {
      this.rethrow(error);
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
      this.rethrow(error);
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
      this.rethrow(error);
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
    try {
      const stored = await this.service.update(
        id,
        body.expectedVersion,
        body.document,
      );
      return this.toEnvelope(stored);
    } catch (error) {
      this.rethrow(error);
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
      this.rethrow(error);
    }
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

  private rethrow(error: unknown): never {
    if (error instanceof PersistRejectedError) {
      throw new BadRequestException({
        message: error.message,
        findings: error.findings,
      });
    }
    if (error instanceof VersionConflictError) {
      throw new ConflictException({
        message: error.message,
        architectureId: error.architectureId,
        expectedVersion: error.expectedVersion,
        actualVersion: error.actualVersion,
      });
    }
    if (
      error instanceof ArchitectureNotFoundError ||
      error instanceof ArchitectureVersionNotFoundError
    ) {
      throw new NotFoundException(error.message);
    }
    throw error;
  }
}
