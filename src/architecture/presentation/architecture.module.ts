import { Module } from '@nestjs/common';
import { ArchitectureService } from '../application/architecture.service';
import { ArchitectureRepository } from '../infrastructure/architecture.repository';
import { getDb } from '../../persistence/db';
import { ArchitectureController } from './architecture.controller';

@Module({
  controllers: [ArchitectureController],
  providers: [
    {
      provide: ArchitectureRepository,
      useFactory: () => new ArchitectureRepository(getDb()),
    },
    {
      provide: ArchitectureService,
      useFactory: (repo: ArchitectureRepository) =>
        new ArchitectureService(repo),
      inject: [ArchitectureRepository],
    },
  ],
  exports: [ArchitectureService],
})
export class ArchitectureModule {}
