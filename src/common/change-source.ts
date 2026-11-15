import { z } from 'zod';

/**
 * Informational persistence metadata only.
 * `approved_extraction` is a client-declared label — not cryptographic proof of human review.
 */
export const changeSourceSchema = z.enum([
  'manual',
  'user_corrected',
  'approved_extraction',
]);

export type ChangeSource = z.infer<typeof changeSourceSchema>;

export const DEFAULT_CHANGE_SOURCE: ChangeSource = 'manual';
