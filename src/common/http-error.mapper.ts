import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PersistRejectedError } from '../architecture/application/architecture.service';
import {
  ArchitectureNotFoundError,
  ArchitectureVersionNotFoundError,
  VersionConflictError,
} from '../architecture/infrastructure/architecture.repository';
import {
  sanitizeForLog,
  type LlmErrorClass,
} from '../llm/errors';

const PROVIDER_INFRA_ERRORS = new Set<LlmErrorClass>([
  'PROVIDER_CONFIG_ERROR',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_INCOMPLETE',
]);

export function isProviderInfrastructureError(
  errorClass: LlmErrorClass,
): boolean {
  return PROVIDER_INFRA_ERRORS.has(errorClass);
}

export function mapDomainErrorToHttp(error: unknown): never {
  if (error instanceof HttpException) {
    throw error;
  }
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
  const message =
    error instanceof Error
      ? sanitizeForLog(error.message)
      : 'Unexpected internal error';
  throw new InternalServerErrorException({
    message,
    errorClass: 'INTERNAL_ERROR',
  });
}

export function throwForLlmFailure(
  errorClass: LlmErrorClass,
  message: string,
): never {
  const sanitized = sanitizeForLog(message);
  if (errorClass === 'INPUT_TOO_LARGE') {
    throw new BadRequestException({
      message: sanitized,
      errorClass,
    });
  }
  if (isProviderInfrastructureError(errorClass)) {
    throw new ServiceUnavailableException({
      message: sanitized,
      errorClass,
    });
  }
  throw new BadRequestException({
    message: sanitized,
    errorClass,
  });
}
