import { defineConfig } from 'drizzle-kit';
export default defineConfig({schema:'./packages/db/schema.ts',out:'./packages/db/generated',dialect:'sqlite'});
// Generated SQL is reviewed and copied into the next numbered Wrangler migration.
// Never use push against production or replace the historical migrations.
