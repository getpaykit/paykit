import type { Pool } from "pg";
import { newDb } from "pg-mem";

import { postgresDatabaseAdapter } from "../database/postgres/postgres.adapter";

export function createTestPool(): Pool {
  const db = newDb();
  db.registerLanguage("plpgsql", () => () => {});
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool & {
    connect: () => Promise<{
      query: (...args: unknown[]) => Promise<unknown>;
      release: () => void;
    }>;
    query: (...args: unknown[]) => Promise<unknown>;
  };

  const sanitizeQuery = (query: unknown): { rowMode: "array" | undefined; value: unknown } => {
    if (!query || typeof query === "string") {
      return { rowMode: undefined, value: query };
    }
    const { rowMode, types: _types, ...rest } = query as Record<string, unknown>;
    return {
      rowMode: rowMode === "array" ? "array" : undefined,
      value: rest,
    };
  };

  const getFieldNames = (query: unknown, result: unknown): string[] => {
    const queryText = typeof query === "string" ? query : (query as { text?: string }).text;

    if (queryText) {
      const selectMatch = queryText.match(/select\s+(.+?)\s+from\s/isu);
      const returningMatch = queryText.match(/returning\s+(.+)$/isu);
      const segment = selectMatch?.[1] ?? returningMatch?.[1];
      if (segment) {
        const matches = [...segment.matchAll(/"([^"]+)"/gu)];
        if (matches.length > 0) {
          return matches.map((match) => match[1]!);
        }
      }
    }

    const queryResult = result as { rows?: Array<Record<string, unknown>> };
    return queryResult.rows?.[0] ? Object.keys(queryResult.rows[0]) : [];
  };

  const adaptResult = (result: unknown, rowMode: "array" | undefined): unknown => {
    if (rowMode !== "array") {
      return result;
    }

    const queryResult = result as {
      rows?: Array<Record<string, unknown>>;
      fields?: Array<{ name: string }>;
    };
    const rows = queryResult.rows ?? [];
    const fieldNames = getFieldNames(currentQuery, result);

    return {
      ...queryResult,
      rows: rows.map((row) => fieldNames.map((fieldName) => row[fieldName])),
    };
  };

  let currentQuery: unknown;
  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  pool.query = ((...args: unknown[]) => {
    const [query, ...rest] = args;
    currentQuery = query;
    const sanitized = sanitizeQuery(query);
    return originalQuery(sanitized.value, ...rest).then((result) =>
      adaptResult(result, sanitized.rowMode),
    );
  }) as typeof pool.query;

  const originalConnect = pool.connect.bind(pool);
  pool.connect = (async () => {
    const client = await originalConnect();
    const originalClientQuery = client.query.bind(client) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    client.query = ((...args: unknown[]) => {
      const [query, ...rest] = args;
      currentQuery = query;
      const sanitized = sanitizeQuery(query);
      return originalClientQuery(sanitized.value, ...rest).then((result) =>
        adaptResult(result, sanitized.rowMode),
      );
    }) as typeof client.query;
    return client;
  }) as typeof pool.connect;

  return pool as unknown as Pool;
}

export async function createMigratedTestPool(): Promise<Pool> {
  const pool = createTestPool();
  await postgresDatabaseAdapter.migrate(pool);
  return pool;
}
