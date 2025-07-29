import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    const sql = neon(databaseUrl);
    dbInstance = drizzle(sql, { schema });
  }

  return dbInstance;
}

export const db = getDb();

export * from "./schema";
