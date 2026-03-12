export function DescriptionSection() {
  return (
    <p className="mb-5 text-sm leading-relaxed text-neutral-700 sm:mb-6 sm:text-[15px] sm:leading-relaxed dark:text-neutral-300">
      PayKit is a payments orchestration framework for TypeScript. It sits between your app and
      payment providers like Stripe or PayPal, giving you a unified API. Webhooks are verified and
      normalized automatically. Your database owns the subscriptions, invoices, and usage records —
      no provider lock-in.
    </p>
  );
}
