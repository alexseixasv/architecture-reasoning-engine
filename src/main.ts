import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { createDb } from './persistence/db';
import { runMigrations } from './persistence/migrate';

async function bootstrap(): Promise<void> {
  await runMigrations();
  createDb();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  app.useBodyParser('json', { limit: '512kb' });

  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen(port);

  Logger.log(
    JSON.stringify({
      msg: 'api_started',
      service: 'architecture-reasoning-engine',
      port,
    }),
  );
}

void bootstrap();
