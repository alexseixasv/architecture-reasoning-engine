import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HISTORICAL_DISCLAIMER,
  type HistoricalSummary,
} from './sanitize';

const SUMMARY_FILES = [
  'baseline-2026-11-15.summary.json',
  'remediation-2026-11-15.summary.json',
] as const;

@Injectable()
export class HistoricalEvidenceService {
  getHistorical(): {
    disclaimer: typeof HISTORICAL_DISCLAIMER;
    artifacts: HistoricalSummary[];
    unavailable: string[];
  } {
    const artifacts: HistoricalSummary[] = [];
    const unavailable: string[] = [];

    for (const fileName of SUMMARY_FILES) {
      const loaded = this.loadSummary(fileName);
      if (loaded) {
        artifacts.push(loaded);
      } else {
        unavailable.push(fileName);
      }
    }

    return {
      disclaimer: HISTORICAL_DISCLAIMER,
      artifacts,
      unavailable,
    };
  }

  private loadSummary(fileName: string): HistoricalSummary | null {
    for (const candidate of this.candidates(fileName)) {
      if (!existsSync(candidate)) continue;
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as HistoricalSummary;
      if (parsed.disclaimer !== HISTORICAL_DISCLAIMER) {
        throw new Error(
          `Historical summary missing required disclaimer: ${fileName}`,
        );
      }
      return parsed;
    }
    return null;
  }

  private candidates(fileName: string): string[] {
    return [
      join(__dirname, fileName),
      join(process.cwd(), 'src', 'evaluation', 'historical', fileName),
      join(process.cwd(), 'dist', 'evaluation', 'historical', fileName),
    ];
  }
}
