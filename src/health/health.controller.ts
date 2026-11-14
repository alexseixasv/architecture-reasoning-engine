import { Controller, Get } from '@nestjs/common';

export type HealthResponse = {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
};

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'architecture-reasoning-engine',
      version: process.env['npm_package_version'] ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
