import path from "node:path";

import { Command } from "commander";
import concurrently, { type CloseEvent as ConcurrentlyCloseEvent } from "concurrently";
import dotenv from "dotenv";
import picocolors from "picocolors";

import type { PaymentProvider } from "../../providers/provider";
import { createStripeAdapter } from "../../stripe/stripe-provider";
import { createDevLogger } from "../utils/dev-logger";
import { getOrCreateDeviceToken } from "../utils/device-token";
import { getPayKitConfig } from "../utils/get-config";
import { capture } from "../utils/telemetry";

const DEFAULT_CLOUD_BASE_URL = "https://wh.paykit.sh";
const DEFAULT_ERROR_BACKOFF_MS = 2_000;
const MAX_ERROR_BACKOFF_MS = 15_000;
const DEFAULT_RETRY_WINDOW = "5m";
const CLI_VERSION = "0.0.4";
const STABLE_SOCKET_RESET_MS = 30_000;
const FORWARD_REPLAY_TIMEOUT_MS = 5_000;
const REPLAY_HEADER = "x-paykit-cloud-replay";
const REPLACED_SESSION_CLOSE_CODE = 4001;
const NO_SPINNER_ENV = "PAYKIT_NO_SPINNER";

interface TunnelResponse {
  found: boolean;
  pendingCount: number;
  providerWebhookEndpointId: string | null;
  tunnelId: string;
  webhookUrl: string;
}

interface DeliveryResponse {
  body: string;
  headers: Record<string, string>;
  id: string;
  method: string;
  receivedAt: string;
}

interface TunnelCapableProvider extends PaymentProvider {
  disableTunnelWebhook(data: { endpointId: string }): Promise<void>;
  ensureTunnelWebhook(data: { existingEndpointId?: string | null; url: string }): Promise<{
    created: boolean;
    endpointId: string;
    webhookSecret?: string;
  }>;
  getTunnelAccount(): Promise<{
    displayName?: string;
    environment: string;
    providerAccountId: string;
    providerId: string;
  }>;
}

interface TunnelAccountSummary {
  displayName?: string;
  environment: string;
  providerAccountId: string;
  providerId: string;
}

interface ReplayResult {
  error?: string;
  ok: boolean;
  status?: number;
}

type DeliveryMode = "direct" | "forward";

interface DeliveryDetails {
  eventId?: string;
  eventType?: string;
}

type TunnelServerMessage =
  | { pendingCount: number; tunnelId: string; type: "hello" }
  | { delivery: DeliveryResponse; type: "delivery" }
  | { type: "pong" }
  | { type: "replay_complete" };

interface RelayRuntimeContext {
  account: TunnelAccountSummary;
  basePath: string;
  config?: Awaited<ReturnType<typeof getPayKitConfig>>;
  deviceToken: string;
  provider: TunnelCapableProvider;
}

function loadDotEnv(cwd: string): void {
  dotenv.config({ path: path.join(cwd, ".env"), quiet: true });
  dotenv.config({ override: true, path: path.join(cwd, ".env.local"), quiet: true });
}

function getEnvStripeOptions(): { secretKey: string; webhookSecret?: string } {
  const secretKey = process.env.E2E_STRIPE_SK ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "No PayKit config found and no Stripe secret key found in env. Set E2E_STRIPE_SK or STRIPE_SECRET_KEY, or pass --config.",
    );
  }

  return {
    secretKey,
    webhookSecret: process.env.E2E_STRIPE_WHSEC ?? process.env.STRIPE_WEBHOOK_SECRET,
  };
}

function isConfigNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("No PayKit configuration file found.");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(cleanup, ms);
    const onAbort = () => cleanup();

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryWindowMs(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "0" || trimmed === "none") {
    return 0;
  }

  const match = /^(\d+)(ms|s|m|h)?$/.exec(trimmed);
  if (!match) {
    throw new Error(`--retry must look like 0, none, 30s, 5m, or 1h. Received "${value}"`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "m";
  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60_000;
    case "h":
      return amount * 60 * 60_000;
    default:
      return amount * 60_000;
  }
}

function normalizeLocalOrigin(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`--forward-to must be an origin only, received "${url}"`);
  }

  return parsed.origin;
}

function buildLocalWebhookUrl(origin: string, basePath: string): string {
  return new URL(`${basePath}/webhook`, `${origin}/`).toString();
}

function formatEnvironment(environment: string): string {
  switch (environment) {
    case "test":
      return "sandbox";
    case "live":
      return "production";
    default:
      return environment;
  }
}

function parseDeliveryDetails(body: string): DeliveryDetails {
  try {
    const parsed = JSON.parse(body) as { id?: unknown; type?: unknown };
    return {
      eventId: typeof parsed.id === "string" ? parsed.id : undefined,
      eventType: typeof parsed.type === "string" ? parsed.type : undefined,
    };
  } catch {
    return {};
  }
}

function isMissingWebhookEndpointError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such webhook endpoint/i.test(message);
}

function printReadyBlock(
  devLogger: ReturnType<typeof createDevLogger>,
  params: {
    account: TunnelAccountSummary;
    deliveryMode: DeliveryMode;
    localWebhookUrl?: string;
    webhookSecret?: string;
    webhookUrl: string;
  },
) {
  const bullet = picocolors.cyan("•");
  const labelWidth = 16;
  const formatLabel = (label: string) => label + " ".repeat(labelWidth - label.length);
  const providerLabel = formatLabel("Stripe");
  const endpointLabel = formatLabel("Webhook endpoint");
  const secretLabel = formatLabel("Webhook secret");
  const accountName = params.account.displayName ?? params.account.providerAccountId;
  const accountSummary = `${accountName} ${picocolors.dim(`(${formatEnvironment(params.account.environment)})`)}`;
  const reminder = params.webhookSecret
    ? `\n${" ".repeat(2 + labelWidth + 1)}${picocolors.dim("^ don't forget add to .env")}`
    : "";

  devLogger.print(
    (params.deliveryMode === "forward" && params.localWebhookUrl
      ? `Webhooks forwarding to ${picocolors.cyan(params.localWebhookUrl)}\n\n`
      : "Webhooks forwarding directly to your PayKit instance\n\n") +
      `${bullet} ${providerLabel} ${accountSummary}\n` +
      `${bullet} ${endpointLabel} ${params.webhookUrl}\n` +
      `${bullet} ${secretLabel} ${params.webhookSecret ?? picocolors.dim("(existing secret hidden)")}${reminder}\n` +
      `Ready!`,
  );
}

function printEnableSummary(
  devLogger: ReturnType<typeof createDevLogger>,
  params: {
    account: TunnelAccountSummary;
    webhookSecret?: string;
    webhookUrl: string;
  },
) {
  const bullet = picocolors.cyan("•");
  const labelWidth = 16;
  const formatLabel = (label: string) => label + " ".repeat(labelWidth - label.length);
  const providerLabel = formatLabel("Stripe");
  const endpointLabel = formatLabel("Webhook endpoint");
  const secretLabel = formatLabel("Webhook secret");
  const accountName = params.account.displayName ?? params.account.providerAccountId;
  const accountSummary = `${accountName} ${picocolors.dim(`(${formatEnvironment(params.account.environment)})`)}`;
  const reminder = params.webhookSecret
    ? `\n${" ".repeat(2 + labelWidth + 1)}${picocolors.dim("^ don't forget add to .env")}`
    : "";

  devLogger.print(
    `Webhook listener enabled.\n\n` +
      `${bullet} ${providerLabel} ${accountSummary}\n` +
      `${bullet} ${endpointLabel} ${params.webhookUrl}\n` +
      `${bullet} ${secretLabel} ${params.webhookSecret ?? picocolors.dim("(existing secret hidden)")}${reminder}\n\n` +
      `You're good to go.`,
  );
}

function printRetrySummary(
  devLogger: ReturnType<typeof createDevLogger>,
  params: {
    deliveryId: string;
    eventId?: string;
    eventType?: string;
  },
) {
  const label = params.eventType ?? "unknown";
  const id = params.eventId ?? params.deliveryId;
  devLogger.print(`Retried ${label} ${picocolors.dim(id)}.`);
}

function assertTunnelProvider(provider: PaymentProvider): TunnelCapableProvider {
  if (
    typeof provider.getTunnelAccount !== "function" ||
    typeof provider.ensureTunnelWebhook !== "function" ||
    typeof provider.disableTunnelWebhook !== "function"
  ) {
    throw new Error(`Provider "${provider.name}" does not support paykitjs listen yet.`);
  }

  return provider as TunnelCapableProvider;
}

function sanitizeReplayHeaders(headers: Record<string, string>): Headers {
  const nextHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "content-length" || lowerKey === "connection" || lowerKey === "host") {
      continue;
    }
    nextHeaders.set(key, value);
  }
  nextHeaders.set(REPLAY_HEADER, "1");
  return nextHeaders;
}

async function requestCloud<T>(
  deviceToken: string,
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${deviceToken}`);
  headers.set("x-paykit-cli-version", CLI_VERSION);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const cloudBaseUrl = getCloudBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${cloudBaseUrl}${pathname}`, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new Error(
      `Could not connect to the PayKit webhook server at ${cloudBaseUrl}. Is the worker running?`,
      { cause: error },
    );
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    if (response.status === 426) {
      let message = body || "This paykitjs CLI version is no longer supported.";
      try {
        const parsed = JSON.parse(body) as { message?: string };
        message = parsed.message ?? message;
      } catch {
        // Non-JSON upgrade responses can still carry a useful text body.
      }
      throw new Error(message);
    }
    const message = contentType.includes("text/html")
      ? `PayKit server request failed (${response.status} ${response.statusText})`
      : body || `PayKit server request failed (${response.status} ${response.statusText})`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function getCloudBaseUrl(): string {
  return (
    process.env.PAYKIT_CLOUD_URL ??
    process.env.PAYKIT_WEBHOOK_API_BASE_URL ??
    DEFAULT_CLOUD_BASE_URL
  );
}

function buildTunnelSocketUrl(params: {
  deviceToken: string;
  includeFailedBefore?: number;
  retryWindowMs: number;
  tunnelId: string;
}): string {
  const cloudUrl = new URL(getCloudBaseUrl());
  cloudUrl.protocol = cloudUrl.protocol === "https:" ? "wss:" : "ws:";
  cloudUrl.pathname = `/api/tunnels/${params.tunnelId}/connect`;
  cloudUrl.search = "";
  cloudUrl.searchParams.set("deviceToken", params.deviceToken);
  cloudUrl.searchParams.set("cliVersion", CLI_VERSION);
  cloudUrl.searchParams.set("retryWindowMs", String(params.retryWindowMs));
  if (typeof params.includeFailedBefore === "number") {
    cloudUrl.searchParams.set("includeFailedBefore", String(params.includeFailedBefore));
  }
  return cloudUrl.toString();
}

async function connectTunnelSocket(params: {
  deviceToken: string;
  includeFailedBefore?: number;
  retryWindowMs: number;
  tunnelId: string;
}): Promise<WebSocket> {
  const socket = new WebSocket(
    buildTunnelSocketUrl({
      deviceToken: params.deviceToken,
      includeFailedBefore: params.includeFailedBefore,
      retryWindowMs: params.retryWindowMs,
      tunnelId: params.tunnelId,
    }),
  );

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("websocket connection failed"));
    };
    const onClose = (event: CloseEvent) => {
      cleanup();
      reject(new Error(`websocket closed (${event.code})`));
    };
    const cleanup = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("close", onClose);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
  });

  return socket;
}

async function consumeTunnelSocket(params: {
  config?: Awaited<ReturnType<typeof getPayKitConfig>>;
  devLogger: ReturnType<typeof createDevLogger>;
  forwardTo?: string;
  onReplayComplete: () => void;
  signal?: AbortSignal;
  socket: WebSocket;
}): Promise<{ code?: number; reason?: string }> {
  return new Promise<{ code?: number; reason?: string }>((resolve, reject) => {
    let settled = false;
    let replayCompleteSeen = false;
    let processing = Promise.resolve();

    const cleanup = () => {
      params.socket.removeEventListener("close", onClose);
      params.socket.removeEventListener("error", onError);
      params.socket.removeEventListener("message", onMessage);
      params.signal?.removeEventListener("abort", onAbort);
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const onClose = (event: CloseEvent) => {
      processing.finally(() =>
        settle(() => resolve({ code: event.code, reason: event.reason || undefined })),
      );
    };
    const onError = () => {
      processing.finally(() => settle(() => reject(new Error("websocket stream failed"))));
    };
    const onAbort = () => {
      processing.finally(() => settle(() => resolve({ code: 1000, reason: "aborted" })));
      try {
        params.socket.close(1000, "aborted");
      } catch {
        // ignore close failures while aborting the socket loop
      }
    };
    const onMessage = (event: MessageEvent) => {
      processing = processing.then(async () => {
        const data = typeof event.data === "string" ? event.data : String(event.data);
        const message = JSON.parse(data) as TunnelServerMessage;

        switch (message.type) {
          case "delivery": {
            const result = await deliverWebhook({
              config: params.config,
              delivery: message.delivery,
              forwardTo: params.forwardTo,
            });
            const details = parseDeliveryDetails(message.delivery.body);
            const eventId = details.eventId ?? message.delivery.id;
            const eventType = details.eventType ?? "unknown";

            if (!result.ok) {
              const statusLabel = result.error ?? String(result.status ?? "failed");
              params.socket.send(
                JSON.stringify({
                  deliveryId: message.delivery.id,
                  error: statusLabel,
                  type: "fail",
                }),
              );
              params.devLogger.event({
                eventId,
                eventType,
                replay: !replayCompleteSeen,
                status: statusLabel,
              });
              return;
            }

            params.socket.send(JSON.stringify({ deliveryId: message.delivery.id, type: "ack" }));
            params.devLogger.event({
              eventId,
              eventType,
              replay: !replayCompleteSeen,
              status: result.status ?? 200,
            });
            return;
          }
          case "replay_complete":
            replayCompleteSeen = true;
            params.onReplayComplete();
            return;
          case "hello":
          case "pong":
            return;
          default:
            throw new Error(
              `Unsupported websocket message type: ${(message as { type?: string }).type}`,
            );
        }
      });
      processing.catch((error) => {
        settle(() => reject(error));
        try {
          params.socket.close();
        } catch {
          // ignore close failures while unwinding the socket loop
        }
      });
    };

    params.socket.addEventListener("close", onClose);
    params.socket.addEventListener("error", onError);
    params.socket.addEventListener("message", onMessage);
    params.signal?.addEventListener("abort", onAbort, { once: true });

    if (params.signal?.aborted) {
      onAbort();
    }
  });
}

async function ensureTunnel(params: {
  account: TunnelAccountSummary;
  createIfMissing: boolean;
  deviceToken: string;
  includeFailedBefore?: number;
  retryWindowMs: number;
}): Promise<TunnelResponse | null> {
  const response = await requestCloud<TunnelResponse>(params.deviceToken, "/api/tunnels/ensure", {
    body: JSON.stringify({
      createIfMissing: params.createIfMissing,
      environment: params.account.environment,
      includeFailedBefore: params.includeFailedBefore,
      providerAccountId: params.account.providerAccountId,
      providerId: params.account.providerId,
      retryWindowMs: params.retryWindowMs,
    }),
    method: "POST",
  });

  return response.found ? response : null;
}

async function attachProviderWebhook(params: {
  deviceToken: string;
  endpointId: string;
  providerWebhookEndpointId: string;
}): Promise<void> {
  await requestCloud(params.deviceToken, `/api/tunnels/${params.endpointId}/provider-webhook`, {
    body: JSON.stringify({ providerWebhookEndpointId: params.providerWebhookEndpointId }),
    method: "POST",
  });
}

async function ackDelivery(params: { deliveryId: string; deviceToken: string }): Promise<void> {
  await requestCloud(params.deviceToken, `/api/deliveries/${params.deliveryId}/ack`, {
    method: "POST",
  });
}

async function getDelivery(params: {
  deliveryId: string;
  deviceToken: string;
}): Promise<DeliveryResponse> {
  return requestCloud(params.deviceToken, `/api/deliveries/${params.deliveryId}`);
}

async function failDelivery(params: {
  deliveryId: string;
  deviceToken: string;
  error: string;
}): Promise<void> {
  await requestCloud(params.deviceToken, `/api/deliveries/${params.deliveryId}/fail`, {
    body: JSON.stringify({ error: params.error }),
    method: "POST",
  });
}

async function replayDelivery(params: {
  delivery: DeliveryResponse;
  localWebhookUrl: string;
  signal?: AbortSignal;
}): Promise<ReplayResult> {
  try {
    const response = await fetch(params.localWebhookUrl, {
      body: params.delivery.body,
      headers: sanitizeReplayHeaders(params.delivery.headers),
      method: params.delivery.method,
      signal: params.signal,
    });

    return { ok: response.ok, status: response.status };
  } catch {
    return { error: "connection failed", ok: false };
  }
}

async function replayDeliveryWithTimeout(params: {
  delivery: DeliveryResponse;
  localWebhookUrl: string;
  timeoutMs: number;
}): Promise<ReplayResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const result = await replayDelivery({
      delivery: params.delivery,
      localWebhookUrl: params.localWebhookUrl,
      signal: controller.signal,
    });
    if (!result.ok && controller.signal.aborted) {
      return { error: `forward-to timeout: ${params.localWebhookUrl}`, ok: false };
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function applyDeliveryDirectly(params: {
  config: Awaited<ReturnType<typeof getPayKitConfig>>;
  delivery: DeliveryResponse;
}): Promise<ReplayResult> {
  try {
    await params.config.paykit.handleWebhook({
      allowUnsignedPayload: true,
      body: params.delivery.body,
      headers: params.delivery.headers,
    });
    return { ok: true, status: 200 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ok: false };
  }
}

async function deliverWebhook(params: {
  config?: Awaited<ReturnType<typeof getPayKitConfig>>;
  delivery: DeliveryResponse;
  forwardTo?: string;
}): Promise<ReplayResult> {
  if (params.forwardTo) {
    return replayDeliveryWithTimeout({
      delivery: params.delivery,
      localWebhookUrl: params.forwardTo,
      timeoutMs: FORWARD_REPLAY_TIMEOUT_MS,
    });
  }

  if (!params.config) {
    return { error: "No PayKit config loaded for direct webhook delivery", ok: false };
  }

  return applyDeliveryDirectly({ config: params.config, delivery: params.delivery });
}

async function syncProviderWebhook(params: {
  deviceToken: string;
  provider: TunnelCapableProvider;
  tunnel: TunnelResponse;
}): Promise<{ webhookSecret?: string }> {
  const providerWebhook = await params.provider.ensureTunnelWebhook({
    existingEndpointId: params.tunnel.providerWebhookEndpointId,
    url: params.tunnel.webhookUrl,
  });

  if (providerWebhook.endpointId !== params.tunnel.providerWebhookEndpointId) {
    await attachProviderWebhook({
      deviceToken: params.deviceToken,
      endpointId: params.tunnel.tunnelId,
      providerWebhookEndpointId: providerWebhook.endpointId,
    });
  }

  return { webhookSecret: providerWebhook.webhookSecret };
}

function getNextErrorBackoff(currentMs: number): number {
  return currentMs === 0 ? DEFAULT_ERROR_BACKOFF_MS : Math.min(currentMs * 2, MAX_ERROR_BACKOFF_MS);
}

function isReplacedSessionClose(close: { code?: number; reason?: string }): boolean {
  return close.code === REPLACED_SESSION_CLOSE_CODE;
}

async function loadRelayRuntimeContext(params: {
  configPath?: string;
  cwd: string;
  devLogger: ReturnType<typeof createDevLogger>;
  requireConfig?: boolean;
}): Promise<RelayRuntimeContext> {
  params.devLogger.start("Loading PayKit config");
  let config: Awaited<ReturnType<typeof getPayKitConfig>> | undefined;
  let basePath = "/paykit";
  let stripeOptions;

  try {
    config = await getPayKitConfig({ configPath: params.configPath, cwd: params.cwd });
    basePath = config.options.basePath ?? basePath;
    stripeOptions = config.options.stripe;
  } catch (error) {
    if (params.configPath || params.requireConfig || !isConfigNotFound(error)) {
      throw error;
    }
    loadDotEnv(params.cwd);
    stripeOptions = getEnvStripeOptions();
  }

  const provider = assertTunnelProvider(createStripeAdapter(stripeOptions));
  const deviceToken = getOrCreateDeviceToken();

  params.devLogger.update("Connecting to Stripe");
  const account = await provider.getTunnelAccount();
  params.devLogger.update("Connecting to PayKit");

  return {
    account,
    basePath,
    config,
    deviceToken,
    provider,
  };
}

async function listenAction(options: {
  config?: string;
  cwd: string;
  forwardTo?: string;
  retry: string;
  signal?: AbortSignal;
  useSpinner?: boolean;
}): Promise<void> {
  const cwd = path.resolve(options.cwd);
  capture("cli_command", { command: "listen" });
  const devLogger = createDevLogger({
    spinner: options.useSpinner ?? process.env[NO_SPINNER_ENV] !== "1",
  });
  const retryWindowMs = parseRetryWindowMs(options.retry);
  const relayStartedAt = Date.now();

  const { account, basePath, config, deviceToken, provider } = await loadRelayRuntimeContext({
    configPath: options.config,
    cwd,
    devLogger,
    requireConfig: !options.forwardTo,
  });
  if (options.signal?.aborted) {
    devLogger.stop();
    return;
  }

  const tunnel = await ensureTunnel({
    account,
    createIfMissing: true,
    deviceToken,
    includeFailedBefore: relayStartedAt,
    retryWindowMs,
  });
  if (options.signal?.aborted) {
    devLogger.stop();
    return;
  }

  if (!tunnel) {
    devLogger.stop();
    throw new Error("Failed to create or load webhook tunnel.");
  }

  devLogger.update("Ensuring webhook endpoint");
  const { webhookSecret } = await syncProviderWebhook({ deviceToken, provider, tunnel });
  if (options.signal?.aborted) {
    devLogger.stop();
    return;
  }

  const localWebhookUrl = options.forwardTo
    ? buildLocalWebhookUrl(normalizeLocalOrigin(options.forwardTo), basePath)
    : undefined;
  devLogger.stop();
  printReadyBlock(devLogger, {
    account,
    deliveryMode: localWebhookUrl ? "forward" : "direct",
    localWebhookUrl,
    webhookSecret,
    webhookUrl: tunnel.webhookUrl,
  });

  if (tunnel.pendingCount > 0) {
    devLogger.info(
      `replaying ${String(tunnel.pendingCount)} missed webhook event${tunnel.pendingCount === 1 ? "" : "s"}`,
    );
  }

  let errorBackoffMs = 0;
  let replayCompleteLogged = false;

  while (!options.signal?.aborted) {
    try {
      const socketConnectedAt = Date.now();
      const socket = await connectTunnelSocket({
        deviceToken,
        includeFailedBefore: relayStartedAt,
        retryWindowMs,
        tunnelId: tunnel.tunnelId,
      });

      if (options.signal?.aborted) {
        socket.close(1000, "aborted");
        return;
      }

      const close = await consumeTunnelSocket({
        config,
        devLogger,
        forwardTo: localWebhookUrl,
        onReplayComplete: () => {
          if (!replayCompleteLogged) {
            replayCompleteLogged = true;
            devLogger.info("replay complete, listening for new webhooks");
          }
        },
        signal: options.signal,
        socket,
      });

      if (options.signal?.aborted) {
        return;
      }

      if (Date.now() - socketConnectedAt >= STABLE_SOCKET_RESET_MS) {
        errorBackoffMs = 0;
      }
      const closeLabel = close.reason
        ? `${String(close.code ?? "unknown")} ${close.reason}`
        : String(close.code ?? "unknown");

      if (isReplacedSessionClose(close)) {
        devLogger.warn(
          "Another paykitjs listen session connected for this tunnel. Stopping this older session.",
        );
        return;
      }

      devLogger.warn(`Listen connection closed: ${closeLabel}`);
      errorBackoffMs = getNextErrorBackoff(errorBackoffMs);
      await sleep(errorBackoffMs, options.signal);
    } catch (error) {
      if (options.signal?.aborted) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      devLogger.warn(`Listen loop failed: ${message}`);
      errorBackoffMs = getNextErrorBackoff(errorBackoffMs);
      await sleep(errorBackoffMs, options.signal);
    }
  }
}

async function listenWithRunCommand(
  runCommand: string[],
  options: {
    config?: string;
    cwd: string;
    forwardTo?: string;
    retry: string;
  },
): Promise<void> {
  const [command, ...args] = runCommand;
  if (!command) {
    await listenAction(options);
    return;
  }

  const cwd = path.resolve(options.cwd);
  const { result } = concurrently(
    [
      {
        command: buildStandaloneListenCommand({ ...options, cwd }),
        env: { [NO_SPINNER_ENV]: "1" },
        name: "pay",
        prefixColor: "cyan",
      },
      {
        command: buildShellCommand([command, ...args]),
        name: "app",
        prefixColor: "blue",
      },
    ],
    {
      cwd,
      killOthersOn: ["success", "failure"],
      killSignal: "SIGINT",
      prefix: "name",
      successCondition: "first",
    },
  );

  try {
    await result;
  } catch (error) {
    if (!Array.isArray(error)) {
      throw error;
    }

    process.exitCode = getConcurrentlyExitCode(error);
  }
}

function buildStandaloneListenCommand(options: {
  config?: string;
  cwd: string;
  forwardTo?: string;
  retry: string;
}): string {
  const command = [process.execPath];
  if (process.argv[1]) {
    command.push(process.argv[1]);
  } else {
    command[0] = "paykitjs";
  }

  command.push("listen", "--cwd", options.cwd, "--retry", options.retry);
  if (options.config) {
    command.push("--config", options.config);
  }
  if (options.forwardTo) {
    command.push("--forward-to", options.forwardTo);
  }

  return buildShellCommand(command);
}

function buildShellCommand(command: string[]): string {
  return command.map(quoteShellArg).join(" ");
}

function quoteShellArg(value: string): string {
  if (/^[\w./:@%+=,-]+$/.test(value)) {
    return value;
  }

  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

function getConcurrentlyExitCode(events: ConcurrentlyCloseEvent[]): number {
  const failedEvent =
    events.find((event) => !event.killed && getExitCode(event.exitCode) !== 0) ??
    events.find((event) => getExitCode(event.exitCode) !== 0);

  return getExitCode(failedEvent?.exitCode ?? 1);
}

function getExitCode(exitCode: ConcurrentlyCloseEvent["exitCode"]): number {
  if (typeof exitCode === "number") {
    return exitCode;
  }

  switch (exitCode) {
    case "SIGINT":
      return 130;
    case "SIGTERM":
      return 143;
    default:
      return 1;
  }
}

async function enableAction(options: { config?: string; cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  capture("cli_command", { command: "listen_enable" });
  const devLogger = createDevLogger();

  const { account, deviceToken, provider } = await loadRelayRuntimeContext({
    configPath: options.config,
    cwd,
    devLogger,
    requireConfig: true,
  });
  const tunnel = await ensureTunnel({
    account,
    createIfMissing: true,
    deviceToken,
    retryWindowMs: 0,
  });

  if (!tunnel) {
    devLogger.stop();
    throw new Error("Failed to create or load webhook tunnel.");
  }

  devLogger.update("Ensuring webhook endpoint");
  const { webhookSecret } = await syncProviderWebhook({ deviceToken, provider, tunnel });

  devLogger.stop();
  printEnableSummary(devLogger, {
    account,
    webhookSecret,
    webhookUrl: tunnel.webhookUrl,
  });
}

async function disableAction(options: { config?: string; cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  capture("cli_command", { command: "listen_disable" });
  const devLogger = createDevLogger();

  const { account, deviceToken, provider } = await loadRelayRuntimeContext({
    configPath: options.config,
    cwd,
    devLogger,
    requireConfig: true,
  });
  const tunnel = await ensureTunnel({
    account,
    createIfMissing: false,
    deviceToken,
    retryWindowMs: 0,
  });

  if (!tunnel) {
    devLogger.stop();
    devLogger.print("No webhook tunnel found for this provider account.");
    return;
  }

  if (tunnel.providerWebhookEndpointId) {
    try {
      await provider.disableTunnelWebhook({ endpointId: tunnel.providerWebhookEndpointId });
    } catch (error) {
      if (!isMissingWebhookEndpointError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        devLogger.warn(`Failed to delete provider webhook endpoint: ${message}`);
      }
    }
  }

  await requestCloud(deviceToken, `/api/tunnels/${tunnel.tunnelId}/disable`, { method: "POST" });
  devLogger.stop();
  devLogger.print(picocolors.green("Webhook tunnel disabled."));
}

async function retryAction(options: {
  config?: string;
  cwd: string;
  deliveryId: string;
  forwardTo?: string;
}): Promise<void> {
  const cwd = path.resolve(options.cwd);
  capture("cli_command", { command: "listen_retry" });
  const devLogger = createDevLogger();

  const { basePath, config, deviceToken } = await loadRelayRuntimeContext({
    configPath: options.config,
    cwd,
    devLogger,
    requireConfig: !options.forwardTo,
  });
  const forwardTo = options.forwardTo
    ? buildLocalWebhookUrl(normalizeLocalOrigin(options.forwardTo), basePath)
    : undefined;
  const delivery = await getDelivery({ deliveryId: options.deliveryId, deviceToken });
  devLogger.stop();

  const details = parseDeliveryDetails(delivery.body);
  const result = await deliverWebhook({ config, delivery, forwardTo });
  if (!result.ok) {
    const statusLabel = result.error ?? String(result.status ?? "failed");
    await failDelivery({ deliveryId: delivery.id, deviceToken, error: statusLabel });
    devLogger.event({
      eventId: details.eventId ?? delivery.id,
      eventType: details.eventType ?? "unknown",
      replay: true,
      status: statusLabel,
    });
    throw new Error(
      `Retry failed for ${details.eventType ?? "unknown"} ${details.eventId ?? delivery.id}.`,
    );
  }

  await ackDelivery({ deliveryId: delivery.id, deviceToken });
  devLogger.event({
    eventId: details.eventId ?? delivery.id,
    eventType: details.eventType ?? "unknown",
    replay: true,
    status: result.status ?? 200,
  });
  printRetrySummary(devLogger, {
    deliveryId: delivery.id,
    eventId: details.eventId,
    eventType: details.eventType,
  });
}

function mergeRelaySubcommandOptions<
  TOptions extends { config?: string; cwd?: string; forwardTo?: string; retry?: string },
>(
  options: TOptions,
  command: Command,
): { config?: string; cwd: string; forwardTo?: string; retry?: string } {
  const parentOptions = command.parent?.opts() as
    | { config?: string; cwd?: string; forwardTo?: string; retry?: string }
    | undefined;

  return {
    config: options.config ?? parentOptions?.config,
    cwd: options.cwd ?? parentOptions?.cwd ?? process.cwd(),
    forwardTo: options.forwardTo ?? parentOptions?.forwardTo,
    retry: options.retry ?? parentOptions?.retry,
  };
}

export const listenCommand = new Command("listen")
  .description("Register a provider webhook tunnel, replay missed events, and stream new webhooks")
  .argument(
    "[command...]",
    "command to run while listening. Use -- before the command, for example: paykitjs listen -- pnpm dev",
  )
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .option(
    "--retry <window>",
    "retry failed deliveries received within this window",
    DEFAULT_RETRY_WINDOW,
  )
  .option(
    "--forward-to <url>",
    "forward webhooks to a local app origin instead of applying directly",
  )
  .action((runCommand: string[], options) => listenWithRunCommand(runCommand, options))
  .addCommand(
    new Command("enable")
      .description("Ensure the webhook tunnel and provider webhook endpoint, then exit")
      .option(
        "-c, --cwd <cwd>",
        "the working directory. defaults to the current directory.",
        process.cwd(),
      )
      .option("--config <config>", "the path to the PayKit configuration file to load.")
      .action((options, command) => enableAction(mergeRelaySubcommandOptions(options, command))),
  )
  .addCommand(
    new Command("retry")
      .description("Retry one stored delivery once, then exit")
      .argument("<deliveryId>", "stored delivery id")
      .option(
        "-c, --cwd <cwd>",
        "the working directory. defaults to the current directory.",
        process.cwd(),
      )
      .option("--config <config>", "the path to the PayKit configuration file to load.")
      .option(
        "--forward-to <url>",
        "forward webhook to a local app origin instead of applying directly",
      )
      .action((deliveryId, options, command) =>
        retryAction({
          ...mergeRelaySubcommandOptions(options, command),
          deliveryId,
        }),
      ),
  )
  .addCommand(
    new Command("disable")
      .description("Disable the webhook tunnel for the current provider account")
      .option(
        "-c, --cwd <cwd>",
        "the working directory. defaults to the current directory.",
        process.cwd(),
      )
      .option("--config <config>", "the path to the PayKit configuration file to load.")
      .action((options, command) => disableAction(mergeRelaySubcommandOptions(options, command))),
  );
