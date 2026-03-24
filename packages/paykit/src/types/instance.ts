import type { PayKitOptions } from "./options";

type ProductIdFromOptions<TOptions extends PayKitOptions> =
  TOptions["products"] extends readonly (infer TProduct)[]
    ? TProduct extends { id: infer TId extends string }
      ? TId
      : string
    : string;

export type PayKitCheckoutInput<TOptions extends PayKitOptions = PayKitOptions> = {
  productId: ProductIdFromOptions<TOptions>;
  successUrl: string;
  cancelUrl?: string;
  customerId?: string;
};

type PayKitEndpoint<TPath extends string, TBody, TResult> = ((ctx: {
  body: TBody;
}) => Promise<TResult>) & {
  path: TPath;
  options: unknown;
};

export interface PayKitAPI<TOptions extends PayKitOptions = PayKitOptions> {
  checkout: PayKitEndpoint<"/checkout", PayKitCheckoutInput<TOptions>, { url: string }>;
}

export interface PayKitInstance<TOptions extends PayKitOptions = PayKitOptions> {
  options: TOptions;
  handler: (request: Request) => Promise<Response>;
  api: PayKitAPI<TOptions>;
  checkout(input: PayKitCheckoutInput<TOptions>): Promise<{ url: string }>;
  handleWebhook(input: {
    body: string;
    headers: Record<string, string>;
  }): Promise<{ received: true }>;
  $context: Promise<unknown>;
}
