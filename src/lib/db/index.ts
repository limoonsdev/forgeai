import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __forgedSql: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL || "postgres://forged:forged@localhost:5432/forged";

const sql =
  globalThis.__forgedSql ??
  postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
    idle_timeout: 30,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalThis.__forgedSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
