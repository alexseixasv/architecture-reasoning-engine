import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HISTORICAL_DISCLAIMER,
  sanitizeHistoricalArtifact,
  sha256Hex,
  validateRawArtifactStructure,
  VALIDATION_MD_EXPECTATIONS,
} from '../../../src/evaluation/historical/sanitize';
import { HistoricalEvidenceService } from '../../../src/evaluation/historical/historical.service';

const BASELINE = join(
  process.cwd(),
  'artifacts',
  'eval',
  'run-2026-11-15T13-40-00-172Z.json',
);
const REMEDIATION = join(
  process.cwd(),
  'artifacts',
  'eval',
  'run-2026-11-15T13-55-04-443Z.json',
);

describe('historical sanitization', () => {
  it('validates structure and cross-checks VALIDATION.md for both artifacts', () => {
    for (const [path, passLabel] of [
      [BASELINE, 'baseline'],
      [REMEDIATION, 'remediation'],
    ] as const) {
      const bytes = readFileSync(path);
      const raw = JSON.parse(bytes.toString('utf8')) as unknown;
      expect(validateRawArtifactStructure(raw)).toBe(true);
      const result = sanitizeHistoricalArtifact({
        raw,
        sourceArtifactRelativePath: path
          .replace(process.cwd() + '\\', '')
          .replace(process.cwd() + '/', '')
          .replace(/\\/g, '/'),
        sourceBytes: bytes,
        passLabel,
      });
      expect(result.structureOk).toBe(true);
      expect(result.discrepancies).toEqual([]);
      expect(result.summary?.disclaimer).toBe(HISTORICAL_DISCLAIMER);
      expect(result.summary?.sourceArtifactSha256).toBe(sha256Hex(bytes));
      expect(result.summary?.validationMdCrossCheck.ok).toBe(true);
      // Secrets stripped: no providerRequestId in summary JSON
      const serialized = JSON.stringify(result.summary);
      expect(serialized).not.toMatch(/providerRequestId/);
    }
  });

  it('preserves verified baseline aggregates from VALIDATION.md', () => {
    const bytes = readFileSync(BASELINE);
    const raw = JSON.parse(bytes.toString('utf8')) as unknown;
    const { summary } = sanitizeHistoricalArtifact({
      raw,
      sourceArtifactRelativePath: 'artifacts/eval/run-2026-11-15T13-40-00-172Z.json',
      sourceBytes: bytes,
      passLabel: 'baseline',
    });
    expect(summary).not.toBeNull();
    expect(summary!.metrics.fieldAccuracy.matches).toBe(
      VALIDATION_MD_EXPECTATIONS.baseline.fieldMatches,
    );
    expect(summary!.metrics.fieldAccuracy.total).toBe(
      VALIDATION_MD_EXPECTATIONS.baseline.fieldTotal,
    );
    expect(summary!.metrics.scenarioUnsupportedNl.ok).toBe(1);
    expect(summary!.evaluationDate).toBe('2026-11-15');
    expect(summary!.model).toBe('gpt-4.1');
  });

  it('reports discrepancy when field totals are tampered', () => {
    const bytes = readFileSync(BASELINE);
    const raw = JSON.parse(bytes.toString('utf8')) as {
      report: { architectureFieldAccuracy: { matches: number; total: number } };
    };
    raw.report.architectureFieldAccuracy = { matches: 1, total: 1 };
    const result = sanitizeHistoricalArtifact({
      raw,
      sourceArtifactRelativePath: 'artifacts/eval/tampered.json',
      sourceBytes: Buffer.from(JSON.stringify(raw)),
      passLabel: 'baseline',
    });
    expect(result.discrepancies.length).toBeGreaterThan(0);
    expect(result.summary?.validationMdCrossCheck.ok).toBe(false);
  });

  it('committed summaries match source SHA-256 and load via service', () => {
    const service = new HistoricalEvidenceService();
    const payload = service.getHistorical();
    expect(payload.disclaimer).toBe(HISTORICAL_DISCLAIMER);
    expect(payload.unavailable).toEqual([]);
    expect(payload.artifacts).toHaveLength(2);

    const baselineBytes = readFileSync(BASELINE);
    const remediationBytes = readFileSync(REMEDIATION);
    const baselineSha = createHash('sha256')
      .update(baselineBytes)
      .digest('hex');
    const remediationSha = createHash('sha256')
      .update(remediationBytes)
      .digest('hex');

    const baseline = payload.artifacts.find((a) => a.passLabel === 'baseline');
    const remediation = payload.artifacts.find(
      (a) => a.passLabel === 'remediation',
    );
    expect(baseline?.sourceArtifactSha256).toBe(baselineSha);
    expect(remediation?.sourceArtifactSha256).toBe(remediationSha);
    expect(baseline?.metrics.fieldAccuracy).toEqual({
      matches: 120,
      total: 235,
      pct: 51.06,
    });
    expect(remediation?.metrics.fieldAccuracy).toEqual({
      matches: 141,
      total: 244,
      pct: 57.79,
    });
  });

  it('does not invent evaluation dates', () => {
    const bytes = readFileSync(BASELINE);
    const raw = JSON.parse(bytes.toString('utf8')) as { generatedAt: string };
    const { summary } = sanitizeHistoricalArtifact({
      raw,
      sourceArtifactRelativePath: 'artifacts/eval/run-2026-11-15T13-40-00-172Z.json',
      sourceBytes: bytes,
      passLabel: 'baseline',
    });
    expect(summary?.generatedAt).toBe(raw.generatedAt);
    expect(summary?.evaluationDate).toBe(raw.generatedAt.slice(0, 10));
  });
});
