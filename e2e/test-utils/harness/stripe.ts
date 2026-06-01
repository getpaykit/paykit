import { stripe } from "@paykitjs/stripe";
import { chromium, type Locator, type Page } from "playwright";
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
    capabilities: {
      testClocks: true,
      directSubscription: true,
      invoiceWebhooks: true,
      repeatedHostedCheckout: true,
    },

    createProvider() {
      return stripe({ secretKey, webhookSecret });
    },

    applyTestingOverrides(ctx) {
      // Stripe's real subscription create uses payment_behavior: "default_incomplete",
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
      const page = await browser.newPage();

      try {
        await page.goto(url, { waitUntil: "domcontentloaded" });

        // Stripe's hosted checkout uses custom inputs that require per-key events;
        // fill() does not dispatch them correctly, so use pressSequentially.
        await pressIfVisible(page.locator("#cardNumber"), "4242424242424242", 60_000);
        await pressIfVisible(page.locator("#cardExpiry"), "1234");
        await pressIfVisible(page.locator("#cardCvc"), "123");
        await pressIfVisible(page.locator("#billingName"), "Test Customer");
        await pressIfVisible(page.locator("#email"), `checkout-${Date.now()}@e2e.paykit.sh`);
        await pressIfVisible(page.locator("#billingPostalCode"), "10001");

        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.waitFor({ state: "visible", timeout: 30_000 });
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();

        // Wait for Stripe to navigate away from the checkout page (success redirect
        // or embedded confirmation). Don't fail the test if this times out — the
        // webhook poll downstream is the real signal.
        await page
          .waitForURL((u) => !u.toString().includes("checkout.stripe.com"), {
            timeout: 60_000,
          })
          .catch(() => {});
      } catch (error) {
        await captureCheckoutFailure(page);
        throw error;
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

async function pressIfVisible(locator: Locator, value: string, timeout = 5_000): Promise<void> {
  await locator.waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (await locator.isVisible().catch(() => false)) {
    await locator.pressSequentially(value);
  }
}

async function captureCheckoutFailure(page: Page): Promise<void> {
  const path = `test-results/stripe-checkout-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
}

function validateStripeEnv(): void {
  if (!env.E2E_STRIPE_SK || !env.E2E_STRIPE_WHSEC) {
    throw new Error("E2E_STRIPE_SK and E2E_STRIPE_WHSEC must be set");
  }
}
