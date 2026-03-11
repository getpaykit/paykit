import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";

type QueryInput =
  | string
  | {
      rowMode?: "array";
      text?: string;
      values?: unknown[];
    };

export function createPGlitePool(
  dataDir?: string,
): Pool & { closed: boolean; end: () => Promise<void> } {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  let closed = false;

  const query = async (
    queryInput: QueryInput,
    values?: unknown[],
  ): Promise<{
    fields: Array<{ name: string; dataTypeID?: number }>;
    rowCount: number;
    rows: Array<Record<string, unknown>>;
  }> => {
    const normalized =
      typeof queryInput === "string"
        ? {
            rowMode: undefined,
            text: queryInput,
            values,
          }
        : {
            rowMode: queryInput.rowMode,
            text: queryInput.text ?? "",
            values: queryInput.values ?? values,
          };

    const result = await db.query<Record<string, unknown>>(normalized.text, normalized.values);
    if (normalized.rowMode !== "array") {
      return {
        fields: result.fields,
        rowCount: result.rows.length,
        rows: result.rows,
      };
    }

    const fieldNames = result.fields.map((field) => field.name);
    return {
      fields: result.fields,
      rowCount: result.rows.length,
      rows: result.rows.map((row) => {
        const entries = fieldNames.map((fieldName) => [fieldName, row[fieldName]]);
        return Object.fromEntries(entries);
      }),
    };
  };

  return {
    get closed() {
      return closed;
    },
    connect: async () => ({
      query,
      release() {},
    }),
    end: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await db.close();
    },
    query,
  } as Pool & { closed: boolean; end: () => Promise<void> };
}
