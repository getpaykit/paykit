export const DEFAULT_STRIPE_CURRENCY = "usd";

export const SUPPORTED_STRIPE_CURRENCIES = ["usd", "eur"] as const;

export type StripeCurrency = (typeof SUPPORTED_STRIPE_CURRENCIES)[number];

export function getStripeCurrency(options: { currency?: StripeCurrency }): StripeCurrency {
  return options.currency ?? DEFAULT_STRIPE_CURRENCY;
}

export function isSupportedStripeCurrency(value: string): value is StripeCurrency {
  return SUPPORTED_STRIPE_CURRENCIES.includes(value as StripeCurrency);
}
