/**
 * Deterministic Fake LLM demo fixtures.
 * Matches scripts/compose-http-acceptance.ts and fake-demo-handlers regexes.
 */
export const DEMO_ARCHITECTURE_TEXT = [
  'The API service runs 4 replicas, each handling 80 requests per second.',
  'Capacity is the sum across replicas. Baseline ingress traffic is 80 rps into the API.',
].join(' ');

/** Live defense case: multi-service checkout → pricing → postgres. */
export const DEMO_CHECKOUT_PRICING_TEXT = [
  'The checkout API calls the pricing service synchronously with a 2s timeout',
  'and 3 retries. Pricing reads from a single Postgres primary. Checkout also',
  'publishes an event to a queue consumed by the invoicing worker. Checkout',
  'runs 6 replicas, pricing 4, each handling 80 rps. Target is 99.9% availability.',
  'MY actual availability is 95%.',
  '',
  'My actual RPS is 80%',
].join('\n');

export const DEMO_QUESTION_LOAD =
  'At the current baseline load (1x), what is the API utilization?';

export const DEMO_QUESTION_UNSUPPORTED =
  'What is the availability % if the API fails?';

export const DEMO_QUESTION_POSTGRES_LATENCY =
  "Let's suppose my PostgreSQL starts growing up the latency for 2s, what could happen to my architecture?";
