import picocolors from "picocolors";
import StripeSdk from "stripe";

export interface StripeAccountInfo {
  displayName: string;
  mode: "test mode" | "live mode";
}

export async function getStripeAccountInfo(secretKey: string): Promise<StripeAccountInfo> {
  const mode = stripeMode(secretKey);
  try {
    const client = new StripeSdk(secretKey);
    const account = await client.accounts.retrieve();
    const name =
      account.settings?.dashboard?.display_name || account.business_profile?.name || account.id;
    return { displayName: name, mode };
  } catch {
    return { displayName: "unknown", mode };
  }
}

export function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function formatPrice(amountCents: number, interval: string | null): string {
  const dollars = amountCents / 100;
  const formatted = dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  if (!interval) {
    return formatted;
  }
  if (interval === "month") {
    return `${formatted}/mo`;
  }
  if (interval === "year") {
    return `${formatted}/yr`;
  }
  return `${formatted}/${interval}`;
}

export function stripeMode(secretKey: string): "test mode" | "live mode" {
  return secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")
    ? "test mode"
    : "live mode";
}

export function getConnectionString(pool: {
  options?: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
  };
}): string {
  const opts = pool.options;
  if (opts?.connectionString) {
    return maskConnectionString(opts.connectionString);
  }
  if (opts?.host) {
    const user = opts.user ?? "postgres";
    const port = opts.port ?? 5432;
    const db = opts.database ?? "postgres";
    return `postgresql://${user}@${opts.host}:${String(port)}/${db}`;
  }
  return "postgresql://localhost:5432/postgres";
}

export function formatPlanLine(
  action: "created" | "updated" | "unchanged",
  name: string,
  price: string,
): string {
  switch (action) {
    case "created":
      return picocolors.green(`  + ${name} (${price})  new`);
    case "updated":
      return picocolors.yellow(`  ~ ${name} (${price})  updated`);
    case "unchanged":
      return picocolors.dim(`  = ${name} (${price})  unchanged`);
  }
}
