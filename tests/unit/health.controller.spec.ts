import { describe, expect, it } from 'vitest';
import { HealthController } from '../../src/health/health.controller';

describe('HealthController', () => {
  it('returns ok status with service identity', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('architecture-reasoning-engine');
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
