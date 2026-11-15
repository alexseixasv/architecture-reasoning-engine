/**
 * Deterministic Fake LLM demo fixtures.
 * Matches scripts/compose-http-acceptance.ts and fake-demo-handlers regexes.
 */
export const DEMO_ARCHITECTURE_TEXT = [
  'The API service runs 4 replicas, each handling 80 requests per second.',
  'Capacity is the sum across replicas. Baseline ingress traffic is 80 rps into the API.',
].join(' ');

export const DEMO_QUESTION_LOAD =
  'At the current baseline load (1x), what is the API utilization?';

export const DEMO_QUESTION_UNSUPPORTED =
  'What is the availability % if the API fails?';
