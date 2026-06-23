import picocolors from "picocolors";

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

export function formatPrice(
  amountCents: number,
  interval: string | null,
  currency = "usd",
): string {
  const dollars = amountCents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    style: "currency",
  }).format(dollars);
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
