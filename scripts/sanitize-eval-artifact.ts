/**
 * Dev-only: sanitize gitignored live OpenAI eval artifacts into
 * Git-trackable summaries under src/evaluation/historical/.
 *
 * Does not call OpenAI. Does not invent values.
 * Exits non-zero if VALIDATION.md cross-check discrepancies are found
 * (unless --allow-discrepancies is passed for debugging).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sanitizeHistoricalArtifact,
  type HistoricalSummary,
} from '../src/evaluation/historical/sanitize';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'src', 'evaluation', 'historical');

const ARTIFACTS = [
  {
    passLabel: 'baseline' as const,
    relativePath: 'artifacts/eval/run-2026-11-15T13-40-00-172Z.json',
    outName: 'baseline-2026-11-15.summary.json',
  },
  {
    passLabel: 'remediation' as const,
    relativePath: 'artifacts/eval/run-2026-11-15T13-55-04-443Z.json',
    outName: 'remediation-2026-11-15.summary.json',
  },
];

function main(): void {
  const allowDiscrepancies = process.argv.includes('--allow-discrepancies');
  mkdirSync(OUT_DIR, { recursive: true });

  const reports: Array<{
    outName: string;
    sha256: string;
    discrepancies: number;
    summary: HistoricalSummary;
  }> = [];

  for (const art of ARTIFACTS) {
    const abs = join(ROOT, art.relativePath);
    const bytes = readFileSync(abs);
    const raw = JSON.parse(bytes.toString('utf8')) as unknown;
    const result = sanitizeHistoricalArtifact({
      raw,
      sourceArtifactRelativePath: art.relativePath.replace(/\\/g, '/'),
      sourceBytes: bytes,
      passLabel: art.passLabel,
    });

    if (!result.structureOk || !result.summary) {
      console.error(`FAIL structure: ${art.relativePath}`);
      for (const d of result.discrepancies) {
        console.error(`  - ${d.message}`);
      }
      process.exit(1);
    }

    if (result.discrepancies.length > 0) {
      console.error(
        `DISCREPANCIES vs VALIDATION.md (${art.passLabel}):`,
      );
      for (const d of result.discrepancies) {
        console.error(`  - ${d.message}`);
      }
      if (!allowDiscrepancies) {
        console.error(
          'Refusing to write summaries. Re-check VALIDATION.md or pass --allow-discrepancies.',
        );
        process.exit(1);
      }
    }

    const outPath = join(OUT_DIR, art.outName);
    writeFileSync(outPath, `${JSON.stringify(result.summary, null, 2)}\n`, 'utf8');
    reports.push({
      outName: art.outName,
      sha256: result.summary.sourceArtifactSha256,
      discrepancies: result.discrepancies.length,
      summary: result.summary,
    });
    console.log(
      `OK ${art.passLabel}: sha256=${result.summary.sourceArtifactSha256} → ${art.outName}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        written: reports.map((r) => ({
          file: r.outName,
          sourceSha256: r.sha256,
          discrepancies: r.discrepancies,
          fieldAccuracy: r.summary.metrics.fieldAccuracy,
          nodeF1: r.summary.metrics.node.f1,
          depF1: r.summary.metrics.dependency.f1,
        })),
      },
      null,
      2,
    ),
  );
}

main();
