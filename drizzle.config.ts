import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// drizzle-kit runs standalone (not through Next.js), so it does NOT auto-load .env.local.
// Load it explicitly so `npm run db:migrate` uses the same env file as the app.
config({ path: ['.env.local', '.env'] });

// Migrations run against the SESSION pooler / direct connection (DIRECT_URL, port 5432),
// not the transaction pooler (DATABASE_URL, port 6543) which the serverless app uses.
export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },
});
