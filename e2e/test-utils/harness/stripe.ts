import { chromium } from "playwright";
import { default as Stripe } from "stripe";

import type { PaymentProvider } from "../../../packages/paykit/src/providers/provider";
import { env } from "../env";
import type { ProviderHarness } from "./types";

export function createStripeHarness(): ProviderHarness {
  validateStripeEnv();
  const secretKey = env.E2E_STRIPE_SK;
  const webhookSecret = env.E2E_STRIPE_WHSEC;

  const stripeClient = new Stripe(secretKey, { maxNetworkRetries: 3 });

  return {
    id: "stripe",

    createStripeOptions() {
      return { secretKey, webhookSecret };
    },

    applyTestingOverrides(ctx) {
      // Stripe's real createSubscription uses payment_behavior: "default_incomplete",
      // which requires client-side confirmation via Stripe.js. In tests we want the
      // subscription to activate straight away from the server after a PM is attached.
      const provider = ctx.provider as PaymentProvider;
      provider.createSubscription = async (
        data: Parameters<PaymentProvider["createSubscription"]>[0],
      ) => {
        const sub = await stripeClient.subscriptions.create({
          customer: data.providerCustomerId,
          items: [{ price: data.providerProduct.priceId }],
          payment_behavior: "allow_incomplete",
          expand: ["latest_invoice"],
        });

        const firstItem = sub.items.data[0];
        const periodStart = firstItem?.current_period_start ?? null;
        const periodEnd = firstItem?.current_period_end ?? null;
        const latestInvoice = sub.latest_invoice;
        const inv =
          latestInvoice && typeof latestInvoice !== "string"
            ? {
                currency: latestInvoice.currency,
                hostedUrl: latestInvoice.hosted_invoice_url ?? null,
                periodEndAt: latestInvoice.period_end
                  ? new Date(latestInvoice.period_end * 1000)
                  : null,
                periodStartAt: latestInvoice.period_start
                  ? new Date(latestInvoice.period_start * 1000)
                  : null,
                providerInvoiceId: latestInvoice.id,
                status: latestInvoice.status,
                totalAmount: latestInvoice.total,
              }
            : null;

        return {
          invoice: inv,
          paymentUrl: null,
          subscription: {
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at != null ? new Date(sub.canceled_at * 1000) : null,
            currentPeriodEndAt: periodEnd != null ? new Date(periodEnd * 1000) : null,
            currentPeriodStartAt: periodStart != null ? new Date(periodStart * 1000) : null,
            endedAt: sub.ended_at != null ? new Date(sub.ended_at * 1000) : null,
            providerSubscriptionId: sub.id,
            providerSubscriptionScheduleId: null,
            status: sub.status,
          },
        };
      };
    },

    async setupCustomerForDirectSubscription(providerCustomerId: string) {
      const pm = await stripeClient.paymentMethods.attach("pm_card_visa", {
        customer: providerCustomerId,
      });
      await stripeClient.customers.update(providerCustomerId, {
        invoice_settings: { default_payment_method: pm.id },
      });
    },

    async completeCheckout(url: string) {
      const browser = await chromium.launch({ headless: true });

      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });

        const cardPaymentButton = page.locator('[data-testid="card-accordion-item-button"]');
        if ((await cardPaymentButton.count()) > 0) {
          await cardPaymentButton.first().waitFor({ state: "visible" });
          await cardPaymentButton.first().click();
        }

        // Stripe's hosted checkout uses custom inputs that require per-key events;
        // fill() does not dispatch them correctly, so use pressSequentially.
        const cardNumber = page.locator("#cardNumber");
        await cardNumber.waitFor({ timeout: 60_000 });
        await cardNumber.pressSequentially("4242424242424242");

        const cardExpiry = page.locator("#cardExpiry");
        await cardExpiry.waitFor({ timeout: 30_000 });
        await cardExpiry.pressSequentially("1234");

        const cardCvc = page.locator("#cardCvc");
        await cardCvc.waitFor({ timeout: 30_000 });
        await cardCvc.pressSequentially("123");

        const billingName = page.locator("#billingName");
        if ((await billingName.count()) > 0) {
          await billingName.waitFor({ timeout: 30_000 });
          await billingName.pressSequentially("Test Customer");
        }

        const email = page.locator("#email");
        if ((await email.count()) > 0) {
          await email.pressSequentially("checkout@example.com");
        }

        const country = page.locator("#billingCountry");
        if ((await country.count()) > 0) {
          await country.selectOption("US").catch(() => {});
        }

        const postalCode = page.locator("#billingPostalCode");
        if ((await postalCode.count()) > 0) {
          await postalCode.pressSequentially("10001");
        }

        await page.waitForSelector(".SubmitButton-TextContainer", {
          state: "attached",
          timeout: 30_000,
        });
        await page.evaluate(() => {
          const button =
            document.querySelector("button.SubmitButton") ??
            document.querySelector('button[type="submit"]') ??
            document.querySelector(".SubmitButton-TextContainer")?.closest("button");
          if (!(button instanceof HTMLElement)) {
            throw new Error("Stripe Checkout submit button not found");
          }
          button.click();
        });

        // Wait for Stripe to navigate away from the checkout page (success redirect
        // or embedded confirmation). Don't fail the test if this times out — the
        // webhook poll downstream is the real signal.
        await page
          .waitForURL((u) => !u.toString().includes("checkout.stripe.com"), {
            timeout: 60_000,
          })
          .catch(() => {});
      } finally {
        await browser.close();
      }
    },

    async cleanup(ctx) {
      // Delete test clocks for all customers
      for (const providerCustomerId of ctx.providerCustomerIds) {
        try {
          const customer = await stripeClient.customers.retrieve(providerCustomerId);
          if ("deleted" in customer && customer.deleted) continue;
          const testClockId = (customer as Stripe.Customer).test_clock;
          if (testClockId && typeof testClockId === "string") {
            await stripeClient.testHelpers.testClocks.del(testClockId).catch(() => {});
          }
        } catch {
          // Customer may already be deleted
        }
      }
    },

    validateEnv() {
      validateStripeEnv();
    },
  };
}

function validateStripeEnv(): void {
  if (!env.E2E_STRIPE_SK || !env.E2E_STRIPE_WHSEC) {
    throw new Error("E2E_STRIPE_SK and E2E_STRIPE_WHSEC must be set");
  }
}
