import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { PayKitProvider, PayKitProviderCapabilities } from "./provider";

type ProviderWithCapability<TKey extends keyof PayKitProviderCapabilities> = PayKitProvider<
  PayKitProviderCapabilities & Record<TKey, true>
>;

/** Raises a stable error when a billing flow needs an unsupported provider feature. */
export function unsupportedProviderCapability(
  provider: Pick<PayKitProvider, "id" | "name">,
  capability: string,
): PayKitError {
  return PayKitError.from(
    "BAD_REQUEST",
    PAYKIT_ERROR_CODES.PROVIDER_CAPABILITY_UNSUPPORTED,
    `${provider.name} does not support provider capability "${capability}"`,
  );
}

/** Ensures a capability flag is enabled before composing provider primitives. */
export function assertProviderCapability(
  provider: Pick<PayKitProvider, "capabilities" | "id" | "name">,
  capability: string,
  supported: boolean,
): void {
  if (!supported) {
    throw unsupportedProviderCapability(provider, capability);
  }
}

/** Ensures a provider capability flag is enabled and narrows required methods. */
export function assertProviderHasCapability<TKey extends keyof PayKitProviderCapabilities>(
  provider: PayKitProvider,
  capability: TKey,
): asserts provider is ProviderWithCapability<TKey> {
  assertProviderCapability(provider, capability, provider.capabilities[capability]);
}
