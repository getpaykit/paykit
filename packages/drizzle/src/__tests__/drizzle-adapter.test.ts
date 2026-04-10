import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as paykitSchema from "paykitjs/schema";
import { describe, expect, it } from "vitest";

import { drizzleAdapter } from "../drizzle-adapter";

describe("@paykitjs/drizzle", () => {
  it("wraps a Drizzle instance into a DrizzleAdapterInstance", () => {
    const fakeDb = {} as PgDatabase<PgQueryResultHKT, typeof paykitSchema>;
    const adapter = drizzleAdapter(fakeDb);

    expect(adapter._tag).toBe("drizzle-adapter");
    expect(adapter.db).toBe(fakeDb);
  });

  it("accepts a superset schema that includes PayKit tables", () => {
    const extraTable = {} as unknown;
    const supersetSchema = { ...paykitSchema, users: extraTable };
    const fakeDb = {} as PgDatabase<PgQueryResultHKT, typeof supersetSchema>;

    const adapter = drizzleAdapter(fakeDb);
    expect(adapter._tag).toBe("drizzle-adapter");
  });

  it("preserves the db reference exactly", () => {
    const fakeDb = { query: {} } as unknown as PgDatabase<PgQueryResultHKT, typeof paykitSchema>;
    const adapter = drizzleAdapter(fakeDb);

    expect(adapter.db).toBe(fakeDb);
  });
});
