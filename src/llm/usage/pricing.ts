/**
 * Documented OpenAI pricing (USD per 1M tokens).
 * Pricing date: 2026-11-15 (OpenAI public pricing page).
 * Unknown models → estimatedCostUsd = null (never assume $0).
 */
export type ModelPricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  pricingDate: string;
};

const PRICING_DATE = '2026-11-15';

const TABLE: Record<string, ModelPricing> = {
  'gpt-4.1': {
    inputPerMillionUsd: 2.0,
    outputPerMillionUsd: 8.0,
    pricingDate: PRICING_DATE,
  },
  'gpt-4.1-mini': {
    inputPerMillionUsd: 0.4,
    outputPerMillionUsd: 1.6,
    pricingDate: PRICING_DATE,
  },
  'gpt-4.1-nano': {
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.4,
    pricingDate: PRICING_DATE,
  },
  'gpt-4o': {
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10.0,
    pricingDate: PRICING_DATE,
  },
  'gpt-4o-mini': {
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
    pricingDate: PRICING_DATE,
  },
};

export function lookupPricing(model: string): ModelPricing | null {
  return TABLE[model] ?? null;
}

export function estimateCostUsd(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): { estimatedCostUsd: number | null; pricingDate: string | null } {
  const pricing = lookupPricing(input.model);
  if (pricing === null) {
    return { estimatedCostUsd: null, pricingDate: null };
  }
  const cost =
    (input.inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (input.outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  return { estimatedCostUsd: cost, pricingDate: pricing.pricingDate };
}
