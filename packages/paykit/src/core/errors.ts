const errorMessages = {
  CUSTOMER_NOT_FOUND: "Customer not found",
  PROVIDER_NOT_FOUND: "Provider not found",
  PROVIDER_CUSTOMER_NOT_FOUND: "Provider customer not found",
  PAYMENT_METHOD_NOT_FOUND: "Payment method not found",
  PAYMENT_NOT_FOUND: "Payment not found",
  INVALID_WEBHOOK_PROVIDER: "Invalid webhook provider",
} as const;

export type ErrorCode = keyof typeof errorMessages;

export class PayKitError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? errorMessages[code]);
    this.code = code;
    this.name = "PayKitError";
  }
}
