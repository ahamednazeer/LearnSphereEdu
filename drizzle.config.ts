import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL || "./db.sqlite";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
