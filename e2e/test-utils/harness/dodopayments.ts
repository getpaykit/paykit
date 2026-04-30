import { dodopayments } from "@paykitjs/dodopayments";
import { chromium } from "playwright";

import { env } from "../env";
import type { ProviderHarness } from "./types";

export function createDodopaymentsHarness(): ProviderHarness {
  const bearerToken = env.E2E_DODO_BEARER_TOKEN;
  const webhookSecret = env.E2E_DODO_WEBHOOK_SECRET;
  if (!bearerToken || !webhookSecret) {
    throw new Error("E2E_DODO_BEARER_TOKEN and E2E_DODO_WEBHOOK_SECRET must be set");
  }

  return {
    id: "dodopayments",
    capabilities: {
      testClocks: false,
      directSubscription: false,
    },

    createProviderConfig() {
      return dodopayments({ bearerToken, webhookSecret, environment: "test_mode" });
    },

    async setupCustomerForDirectSubscription(_providerCustomerId: string) {
      // DodoPayments doesn't support direct subscription — always goes through checkout.
      // This is a no-op; tests will get a paymentUrl and call completeCheckout.
    },

    async completeCheckout(url: string) {
      const browser = await chromium.launch({ headless: false });
      const page = await browser.newPage();

      try {
        await page.goto(url, { waitUntil: "networkidle" });

        const addBtn = page.getByRole("button", { name: "Enter address manually" });
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();
          await page.waitForSelector('input[name="city"]', { timeout: 10000 });

          // Submit Address
          await page.locator('select[name="country"]').selectOption("United States");
          await page.getByRole("textbox", { name: "Address Line" }).fill("177A Bleecker Street");
          await page.getByRole("textbox", { name: "City" }).fill("New York");
          await page.getByRole("textbox", { name: "Zip Code" }).fill("10012");
          await page.getByRole("textbox", { name: "State" }).fill("New York");
          const submitButton = page.getByRole("button", { name: "Continue to Payment" });
          await submitButton.click();

          await page.waitForTimeout(2000);
        }

        // Wait for payment section
        await page.waitForSelector(
          'iframe[title*="Dodo"], [data-testid="payment-form"], button:has-text("Pay")',
          { timeout: 15000 },
        );

        const iframeLocator = page.locator('iframe[title*="Dodo Payments"]');
        const iframeForm = iframeLocator.contentFrame();
        await iframeForm
          .getByRole("button", { name: "Card" })
          .waitFor({ state: "visible", timeout: 10000 })
          .catch(() => {});
        await iframeForm
          .getByRole("button", { name: "Card" })
          .click()
          .catch(() => {});

        await iframeForm.getByRole("textbox", { name: "Card number" }).fill("5555555555554444");
        await iframeForm.getByRole("textbox", { name: "Expiry" }).fill("06/32");
        await iframeForm.getByRole("textbox", { name: "Security code" }).fill("123");
        await iframeForm.getByRole("textbox", { name: "Name on card" }).fill("Steven Strange");

        await page.getByRole("button", { name: /pay|subscribe/i }).click();

        // Wait for redirect to success URL or confirmation
        await page.waitForURL("**/success**", { timeout: 30_000 }).catch(() => {
          // Some checkouts show a confirmation page rather than redirecting
        });
      } finally {
        await browser.close();
      }
    },

    async cleanup(_ctx) {
      // DodoPayments test mode has no test clocks to clean up.
      // Subscriptions in test mode are ephemeral.
    },

    validateEnv() {
      if (!env.E2E_DODO_BEARER_TOKEN || !env.E2E_DODO_WEBHOOK_SECRET) {
        throw new Error("E2E_DODO_BEARER_TOKEN and E2E_DODO_WEBHOOK_SECRET must be set");
      }
    },
  };
}
