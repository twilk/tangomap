import { defineConfig } from 'drizzle-kit';

// Migrations run against the SESSION pooler / direct connection (DIRECT_URL, port 5432),
// not the transaction pooler (DATABASE_URL, port 6543) which the serverless app uses.
export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },
});
