import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { polar } from "@paykitjs/polar";
import { chromium, type Frame, type Locator, type Page } from "playwright";

import { env } from "../env";
import type { ProviderHarness } from "./types";

const POLAR_CHECKOUT_THROTTLE_FILE = "/tmp/paykit-polar-checkout-throttle";
const POLAR_MIN_CHECKOUT_BEFORE_SUBMIT_MS = 15_000;
const POLAR_MIN_CHECKOUT_API_INTERVAL_MS = 75_000;

const checkoutDetailsBySecret = new Map<string, PolarClientCheckout>();

export function createPolarHarness(): ProviderHarness {
  const accessToken = env.E2E_POLAR_ACCESS_TOKEN;
  const webhookSecret = env.E2E_POLAR_WHSEC;
  if (!accessToken || !webhookSecret) {
    throw new Error("E2E_POLAR_ACCESS_TOKEN and E2E_POLAR_WHSEC must be set");
  }

  return {
    id: "polar",
    capabilities: {
      testClocks: false,
      directSubscription: false,
      invoiceWebhooks: false,
      repeatedHostedCheckout: false,
    },

    createProvider() {
      return polar({ accessToken, webhookSecret, server: "sandbox" });
    },

    applyTestingOverrides(ctx) {
      const createSubscriptionCheckout = ctx.provider.createSubscriptionCheckout?.bind(
        ctx.provider,
      );
      if (!createSubscriptionCheckout) return;

      ctx.provider.createSubscriptionCheckout = async (data) => {
        const result = await createSubscriptionCheckout(data);
        if (env.E2E_POLAR_CHECKOUT_MODE === "direct") {
          await rememberCheckoutDetails({
            accessToken,
            clientSecret: getPolarCheckoutClientSecret(result.paymentUrl),
            providerCheckoutSessionId: result.providerCheckoutSessionId,
          });
        }
        return result;
      };
    },

    async setupCustomerForDirectSubscription(_providerCustomerId: string) {
      // Polar doesn't support direct subscription — always goes through checkout.
      // This is a no-op; tests will get a paymentUrl and call completeCheckout.
    },

    async completeCheckout(url: string) {
      if (env.E2E_POLAR_CHECKOUT_MODE === "manual") {
        await waitForManualCheckout(url);
        return;
      }

      if (env.E2E_POLAR_CHECKOUT_MODE === "direct") {
        await completeCheckoutViaClientApi(url);
        return;
      }

      await completeHostedCheckout(url);
    },

    async cleanup(_ctx) {
      // Polar sandbox has no test clocks to clean up.
      // Subscriptions in sandbox are ephemeral.
    },

    validateEnv() {
      if (!env.E2E_POLAR_ACCESS_TOKEN || !env.E2E_POLAR_WHSEC) {
        throw new Error("E2E_POLAR_ACCESS_TOKEN and E2E_POLAR_WHSEC must be set");
      }
    },
  };
}

async function completeCheckoutViaClientApi(url: string): Promise<void> {
  const clientSecret = getPolarCheckoutClientSecret(url);
  const checkout =
    checkoutDetailsBySecret.get(clientSecret) ?? (await getPolarClientCheckout(clientSecret));
  const publishableKey = checkout.paymentProcessorMetadata.publishable_key;
  if (!publishableKey) throw new Error("Polar checkout is missing Stripe publishable key");

  const confirmationTokenId = await createStripeConfirmationToken({
    amount: checkout.totalAmount || checkout.amount,
    currency: checkout.currency,
    email: checkout.customerEmail ?? `checkout-${Date.now()}@e2e.paykit.sh`,
    name: checkout.customerName ?? "Test Customer",
    publishableKey,
  });

  await confirmPolarCheckout(clientSecret, {
    confirmationTokenId,
    customerBillingAddress: {
      city: "San Francisco",
      country: "US",
      line1: "1 Test St",
      line2: "",
      postal_code: "94105",
      state: "CA",
    },
    customerBillingName: checkout.customerName ?? "Test Customer",
    customerEmail: checkout.customerEmail ?? `checkout-${Date.now()}@e2e.paykit.sh`,
    customerName: checkout.customerName ?? "Test Customer",
  });
}

async function rememberCheckoutDetails(input: {
  accessToken: string;
  clientSecret: string;
  providerCheckoutSessionId: string;
}): Promise<void> {
  const checkout = await getAuthenticatedPolarCheckout({
    accessToken: input.accessToken,
    checkoutId: input.providerCheckoutSessionId,
  });
  checkoutDetailsBySecret.set(input.clientSecret, checkout);
}

interface PolarClientCheckout {
  amount: number;
  currency: string;
  customerEmail: string | null;
  customerName: string | null;
  paymentProcessorMetadata: Record<string, string>;
  totalAmount: number;
}

async function getPolarClientCheckout(clientSecret: string): Promise<PolarClientCheckout> {
  const response = await fetchPolarCheckoutClient(
    `https://sandbox-api.polar.sh/v1/checkouts/client/${clientSecret}`,
  );
  if (!response.ok) {
    throw new Error(
      `Polar client checkout lookup failed: ${String(response.status)} ${await response.text()}`,
    );
  }
  return parsePolarCheckout(await response.json());
}

async function getAuthenticatedPolarCheckout(input: {
  accessToken: string;
  checkoutId: string;
}): Promise<PolarClientCheckout> {
  const response = await fetch(`https://sandbox-api.polar.sh/v1/checkouts/${input.checkoutId}`, {
    headers: { authorization: `Bearer ${input.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `Polar checkout lookup failed: ${String(response.status)} ${await response.text()}`,
    );
  }
  return parsePolarCheckout(await response.json());
}

function parsePolarCheckout(data: unknown): PolarClientCheckout {
  const checkout = data as {
    amount?: unknown;
    currency?: unknown;
    customerEmail?: unknown;
    customerName?: unknown;
    customer_email?: unknown;
    customer_name?: unknown;
    paymentProcessorMetadata?: unknown;
    payment_processor_metadata?: unknown;
    totalAmount?: unknown;
    total_amount?: unknown;
  };

  const paymentProcessorMetadata =
    checkout.payment_processor_metadata ?? checkout.paymentProcessorMetadata;
  return {
    amount: typeof checkout.amount === "number" ? checkout.amount : 0,
    currency: typeof checkout.currency === "string" ? checkout.currency : "usd",
    customerEmail:
      typeof checkout.customer_email === "string"
        ? checkout.customer_email
        : typeof checkout.customerEmail === "string"
          ? checkout.customerEmail
          : null,
    customerName:
      typeof checkout.customer_name === "string"
        ? checkout.customer_name
        : typeof checkout.customerName === "string"
          ? checkout.customerName
          : null,
    paymentProcessorMetadata:
      paymentProcessorMetadata && typeof paymentProcessorMetadata === "object"
        ? (paymentProcessorMetadata as Record<string, string>)
        : {},
    totalAmount:
      typeof checkout.total_amount === "number"
        ? checkout.total_amount
        : typeof checkout.totalAmount === "number"
          ? checkout.totalAmount
          : 0,
  };
}

async function confirmPolarCheckout(
  clientSecret: string,
  input: {
    confirmationTokenId: string;
    customerBillingAddress: {
      city: string;
      country: string;
      line1: string;
      line2: string;
      postal_code: string;
      state: string;
    };
    customerBillingName: string;
    customerEmail: string;
    customerName: string;
  },
): Promise<void> {
  const response = await fetchPolarCheckoutClient(
    `https://sandbox-api.polar.sh/v1/checkouts/client/${clientSecret}/confirm`,
    {
      body: JSON.stringify({
        confirmation_token_id: input.confirmationTokenId,
        customer_billing_address: input.customerBillingAddress,
        customer_billing_name: input.customerBillingName,
        customer_email: input.customerEmail,
        customer_name: input.customerName,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Polar client checkout confirm failed: ${String(response.status)} ${await response.text()}`,
    );
  }
}

async function fetchPolarCheckoutClient(url: string, init?: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await waitForPolarCheckoutApiSlot();
    const response = await fetch(url, init);
    await recordPolarCheckoutApiAttempt();

    if (response.status !== 429) return response;

    lastResponse = response;
    console.warn(
      `Polar checkout client API returned 429 for ${new URL(url).pathname}; waiting before retry ${String(attempt + 1)}/4`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, getRetryAfterMs(response) ?? POLAR_MIN_CHECKOUT_API_INTERVAL_MS),
    );
  }

  return lastResponse ?? fetch(url, init);
}

async function createStripeConfirmationToken(input: {
  amount: number;
  currency: string;
  email: string;
  name: string;
  publishableKey: string;
}): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 720 } });

  try {
    await page.route("https://paykit.local/stripe-confirm", async (route) => {
      await route.fulfill({
        body: `<!doctype html>
          <html>
            <head><script src="https://js.stripe.com/v3/"></script></head>
            <body><form id="payment-form"><div id="payment-element"></div></form></body>
          </html>`,
        contentType: "text/html",
      });
    });
    await page.goto("https://paykit.local/stripe-confirm", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.Stripe === "function", null, {
      timeout: 30_000,
    });

    await page.evaluate(({ amount, currency, publishableKey }) => {
      const stripe = window.Stripe(publishableKey);
      const elements = stripe.elements({ amount, currency, mode: "payment" });
      const payment = elements.create("payment");
      payment.mount("#payment-element");
      window.__paykitStripe = { elements, stripe };
    }, input);

    const paymentFrame = page.frameLocator('iframe[title="Secure payment input frame"]');

    await fillRequired(
      paymentFrame.locator(
        'input[name="number"], input[autocomplete="cc-number"], input[placeholder*="card number" i]',
      ),
      "4242424242424242",
      60_000,
    );
    await fillRequired(
      paymentFrame.locator(
        'input[name="expiry"], input[autocomplete="cc-exp"], input[placeholder*="MM" i]',
      ),
      "1230",
    );
    await fillRequired(
      paymentFrame.locator(
        'input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC" i]',
      ),
      "123",
    );

    const result = await page.evaluate(async ({ email, name }) => {
      const stripeState = window.__paykitStripe;
      const submit = await stripeState.elements.submit();
      if (submit.error) throw new Error(submit.error.message);
      const token = await stripeState.stripe.createConfirmationToken({
        elements: stripeState.elements,
        params: {
          payment_method_data: {
            billing_details: {
              address: {
                city: "San Francisco",
                country: "US",
                line1: "1 Test St",
                postal_code: "94105",
                state: "CA",
              },
              email,
              name,
            },
          },
        },
      });
      if (token.error) throw new Error(token.error.message);
      return token.confirmationToken.id;
    }, input);

    return result;
  } catch (error) {
    await captureCheckoutFailure(page, "direct-confirm");
    throw error;
  } finally {
    await browser.close();
  }
}

function getPolarCheckoutClientSecret(url: string): string {
  const parsed = new URL(url);
  const secret = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (!secret) throw new Error(`Unable to read Polar checkout client secret from URL: ${url}`);
  return secret;
}

async function completeHostedCheckout(url: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const checkoutDiagnostics: string[] = [];
  const openedAt = Date.now();

  page.on("requestfailed", (request) => {
    checkoutDiagnostics.push(
      `request failed ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      checkoutDiagnostics.push(`response ${String(response.status())} ${response.url()}`);
    }
  });

  try {
    await waitForPolarCheckoutApiSlot();
    await page.goto(url, { timeout: 90_000, waitUntil: "domcontentloaded" });
    await recordPolarCheckoutApiAttempt();

    const paymentFrame = page.frameLocator('iframe[src*="elements-inner-accessory-target"]');

    await fillRequired(
      paymentFrame.locator(
        '[data-testid="card-number"], input[name="cardNumber"], input[autocomplete="cc-number"], input[placeholder*="card number" i], input[placeholder="1234 1234 1234 1234"]',
      ),
      "4242424242424242",
      60_000,
    );
    await fillRequired(
      paymentFrame.locator(
        '[data-testid="card-expiry"], input[name="cardExpiry"], input[autocomplete="cc-exp"], input[placeholder*="MM" i], input[placeholder="MM / YY"]',
      ),
      "12/30",
    );
    await fillRequired(
      paymentFrame.locator(
        '[data-testid="card-cvc"], input[name="cardCvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC" i]',
      ),
      "123",
    );
    await fillOptional(
      page.locator(
        '[data-testid="cardholder-name"], input[name="cardholderName"], input[autocomplete="cc-name"], input[placeholder*="name" i]',
      ),
      "Test Customer",
    );
    await fillOptional(
      page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]'),
      `checkout-${Date.now()}@e2e.paykit.sh`,
    );
    await selectBillingCountry(page);
    await fillCheckoutInput(page, 'input[name="customer_billing_address.line1"]', "1 Test St");
    await fillCheckoutInput(page, 'input[name="customer_billing_address.postal_code"]', "94105");
    await fillCheckoutInput(page, 'input[name="customer_billing_address.city"]', "San Francisco");
    await selectBillingState(page);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.keyboard.press("Tab").catch(() => undefined);
    await page.waitForTimeout(2_000);

    const submitButton =
      (await findVisibleLocator(page, 'button:has-text("Subscribe now")')) ??
      (await findVisibleLocator(page, 'button:has-text("Pay")')) ??
      (await findVisibleLocator(page, 'button:has-text("Subscribe")'));
    if (!submitButton) throw new Error("Polar checkout submit button was not found");
    await submitButton.waitFor({ state: "visible", timeout: 30_000 });
    await waitForEnabled(submitButton, 15_000);
    checkoutDiagnostics.push(await describeCheckoutSubmit(page, submitButton));

    await submitCheckoutOnce(page, submitButton, checkoutDiagnostics, openedAt);
  } catch (error) {
    await captureCheckoutFailure(page);
    throw error;
  } finally {
    await browser.close();
  }
}

declare global {
  interface Window {
    Stripe: (publishableKey: string) => {
      elements: (options: { amount: number; currency: string; mode: "payment" }) => StripeElements;
      createConfirmationToken: (input: {
        elements: StripeElements;
        params: {
          payment_method_data: {
            billing_details: {
              address: {
                city: string;
                country: string;
                line1: string;
                postal_code: string;
                state: string;
              };
              email: string;
              name: string;
            };
          };
        };
      }) => Promise<
        | { confirmationToken: { id: string }; error?: undefined }
        | { confirmationToken?: undefined; error: { message?: string } }
      >;
    };
    __paykitStripe: {
      elements: StripeElements;
      stripe: ReturnType<Window["Stripe"]>;
    };
  }
}

interface StripeElements {
  create: (type: "payment") => { mount: (selector: string) => void };
  submit: () => Promise<{ error?: { message?: string } }>;
}

async function waitForManualCheckout(url: string): Promise<void> {
  console.info("\nPolar manual checkout mode enabled.");
  console.info(`Open and complete this checkout:\n${url}`);
  console.info("Waiting for PayKit to observe the checkout webhooks.\n");
}

async function submitCheckoutOnce(
  page: Page,
  submitButton: Locator,
  diagnostics: string[],
  openedAt: number,
): Promise<void> {
  const remaining = POLAR_MIN_CHECKOUT_BEFORE_SUBMIT_MS - (Date.now() - openedAt);
  if (remaining > 0) await page.waitForTimeout(remaining);
  await waitForPolarCheckoutApiSlot();

  await page.keyboard.press("Escape").catch(() => undefined);
  await centerLocator(submitButton);
  diagnostics.push(`before click: ${JSON.stringify(await describeLocator(submitButton))}`);

  const clickAttempts: Array<() => Promise<void>> = [
    () => submitButton.click({ timeout: 10_000 }),
    () => clickLikeUser(page, submitButton),
    () => submitButton.evaluate((el) => (el as HTMLElement).click()),
  ];

  for (let attempt = 0; attempt < clickAttempts.length; attempt += 1) {
    const confirmResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes("/checkouts/client/") && response.url().includes("/confirm"),
        { timeout: 15_000 },
      )
      .catch(() => null);

    await clickAttempts[attempt]!();
    const response = await confirmResponse;
    diagnostics.push(
      `after click ${String(attempt + 1)}: ${await describeCheckoutSubmit(page, submitButton)}`,
    );

    if (!response) {
      diagnostics.push(`confirm request not observed after click ${String(attempt + 1)}`);
      continue;
    }

    await recordPolarCheckoutApiAttempt();

    const responseText = await response.text().catch(() => "");
    diagnostics.push(
      `confirm response ${String(response.status())} ${response.url()} ${responseText.slice(0, 1_000)}`,
    );
    if (response.status() === 429) {
      await page.waitForTimeout(getRetryAfterMs(response) ?? POLAR_MIN_CHECKOUT_API_INTERVAL_MS);
      continue;
    }

    if (response.status() >= 400) {
      throw new Error(`Polar checkout confirm failed:\n${diagnostics.join("\n")}`);
    }

    await Promise.race([
      page.waitForURL((u) => u.toString().startsWith("https://example.com/success"), {
        timeout: 15_000,
      }),
      page
        .getByText(/thank you|payment complete|subscription active|subscribed/i)
        .first()
        .waitFor({ timeout: 15_000 }),
    ]).catch(() => undefined);
    return;
  }

  throw new Error(`Polar checkout confirm request was not observed:\n${diagnostics.join("\n")}`);
}

async function waitForPolarCheckoutApiSlot(): Promise<void> {
  const last = Number(await readFile(POLAR_CHECKOUT_THROTTLE_FILE, "utf8").catch(() => "0"));
  const wait = POLAR_MIN_CHECKOUT_API_INTERVAL_MS - (Date.now() - last);
  if (Number.isFinite(wait) && wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

async function recordPolarCheckoutApiAttempt(): Promise<void> {
  await mkdir(dirname(POLAR_CHECKOUT_THROTTLE_FILE), { recursive: true }).catch(() => undefined);
  await writeFile(POLAR_CHECKOUT_THROTTLE_FILE, String(Date.now())).catch(() => undefined);
}

function getRetryAfterMs(
  response: { headers: Headers } | { headers(): Record<string, string> },
): number | null {
  const retryAfter =
    typeof response.headers === "function"
      ? response.headers()["retry-after"]
      : response.headers.get("retry-after");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds))
    return Math.max(seconds * 1_000, POLAR_MIN_CHECKOUT_API_INTERVAL_MS);

  const date = Date.parse(retryAfter);
  if (Number.isNaN(date)) return null;
  return Math.max(date - Date.now(), POLAR_MIN_CHECKOUT_API_INTERVAL_MS);
}

async function selectBillingCountry(page: Page): Promise<void> {
  const select = page.locator('select[autocomplete="billing country"]').first();
  await select.waitFor({ state: "visible", timeout: 15_000 });
  await select.selectOption("US");
  await expectInputValue(select, "US", "Polar checkout billing country");
  await page.locator('input[name="customer_billing_address.line1"]').first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

async function selectBillingState(page: Page): Promise<void> {
  const select = page.locator('select[autocomplete="billing address-level1"]').first();
  await select.waitFor({ state: "visible", timeout: 15_000 });
  await select.selectOption("US-CA");
  await expectInputValue(select, "US-CA", "Polar checkout billing state");
}

async function fillCheckoutInput(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector).first();
  await input.waitFor({ state: "visible", timeout: 15_000 });
  await input.click({ force: true });
  await input.fill(value).catch(async () => {
    await input.pressSequentially(value);
  });
  await expectInputValue(input, value, `Polar checkout field ${selector}`);
}

async function expectInputValue(locator: Locator, expected: string, label: string): Promise<void> {
  const actual = await locator.inputValue().catch(() => "");
  if (actual !== expected)
    throw new Error(`${label} was not filled; expected ${expected}, got ${actual}`);
}

function locatorRoots(page: Page): Array<Page | Frame> {
  return [page, ...page.frames()];
}

async function findVisibleLocator(page: Page, selector: string): Promise<Locator | null> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    for (const root of locatorRoots(page)) {
      const locator = root.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const candidate = locator.nth(i);
        if (!(await candidate.isVisible().catch(() => false))) continue;
        if (!(await candidate.isEnabled().catch(() => false))) continue;
        return candidate;
      }
    }
    await page.waitForTimeout(100);
  }

  return null;
}

async function fillRequired(locator: Locator, value: string, timeout = 5_000): Promise<void> {
  const input = locator.first();
  await input.waitFor({ state: "visible", timeout });
  await input.click({ force: true });
  await input.fill("").catch(() => undefined);
  await input.pressSequentially(value, { delay: 20 });
}

async function fillOptional(locator: Locator, value: string, timeout = 5_000): Promise<void> {
  await locator
    .first()
    .waitFor({ state: "visible", timeout })
    .catch(() => undefined);
  if (
    (await locator
      .first()
      .isVisible()
      .catch(() => false)) &&
    (await locator
      .first()
      .isEnabled()
      .catch(() => false))
  ) {
    const input = locator.first();
    const existing = await input.inputValue().catch(() => "");
    if (existing.trim()) return;
    await input.click({ force: true });
    await input.fill("").catch(() => undefined);
    await input.pressSequentially(value, { delay: 10 });
  }
}

async function clickLikeUser(page: Page, locator: Locator): Promise<void> {
  const first = locator.first();
  await centerLocator(first);
  const box = await first.boundingBox();
  if (!box) {
    await first.click({ timeout: 10_000 });
    return;
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
}

async function centerLocator(locator: Locator): Promise<void> {
  await locator
    .evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }))
    .catch(async () => {
      await locator.scrollIntoViewIfNeeded();
    });
}

async function waitForEnabled(locator: Locator, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (
      await locator
        .first()
        .isEnabled()
        .catch(() => false)
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("Polar checkout submit button did not become enabled");
}

async function describeCheckoutSubmit(page: Page, submitButton: Locator): Promise<string> {
  const [button, activeElement, visibleAlerts, url] = await Promise.all([
    describeLocator(submitButton),
    page
      .evaluate(() => {
        const el = document.activeElement;
        if (!el) return "none";
        return `${el.tagName.toLowerCase()} ${el.getAttribute("name") ?? ""} ${el.getAttribute("placeholder") ?? ""} ${el.textContent?.slice(0, 80) ?? ""}`;
      })
      .catch((error: unknown) => `active element unavailable: ${String(error)}`),
    page
      .locator('[role="alert"], [aria-live], .error, [data-testid*="error" i]')
      .evaluateAll((els) =>
        els.map((el) => el.textContent?.trim()).filter((text): text is string => Boolean(text)),
      )
      .catch(() => []),
    Promise.resolve(page.url()),
  ]);

  return JSON.stringify({ activeElement, button, url, visibleAlerts });
}

async function describeLocator(locator: Locator): Promise<Record<string, unknown>> {
  const first = locator.first();
  const [box, enabled, text, visible] = await Promise.all([
    first.boundingBox().catch(() => null),
    first.isEnabled().catch(() => false),
    first.innerText({ timeout: 1_000 }).catch(() => ""),
    first.isVisible().catch(() => false),
  ]);

  return { box, enabled, text, visible };
}

async function captureCheckoutFailure(page: Page, label = "failure"): Promise<void> {
  const path = `test-results/polar-checkout-${label}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
}
