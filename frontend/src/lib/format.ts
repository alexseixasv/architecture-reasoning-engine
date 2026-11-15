export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a (pricing incomplete or unavailable)';
  }
  return `$${value.toFixed(6)}`;
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(1)} ms`;
}
