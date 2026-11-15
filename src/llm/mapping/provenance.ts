import { finding } from '../../architecture/domain/findings';
import type { ValidationFinding } from '../../architecture/domain/types';

/**
 * Excerpt must appear as a contiguous substring of the source text.
 * Comparison is exact after normalizing newlines to \n (no fuzzy match).
 */
export function excerptAppearsInSource(
  sourceText: string,
  excerpt: string,
): boolean {
  if (excerpt.length === 0) {
    return false;
  }
  const source = sourceText.replace(/\r\n/g, '\n');
  const needle = excerpt.replace(/\r\n/g, '\n');
  return source.includes(needle);
}

export function provenanceFinding(
  path: string,
  excerpt: string,
): ValidationFinding {
  return finding({
    code: 'PROVENANCE_UNVERIFIED',
    severity: 'WARNING',
    findingClass: 'semantic',
    path,
    message: `Declared quantity source excerpt was not found in the architecture description; value not treated as verified declaration. Excerpt: ${excerpt.slice(0, 80)}`,
  });
}
