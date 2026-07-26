import { defineConfig } from 'drizzle-kit';

// Used for `drizzle-kit generate` only: migrations are plain SQL in ./drizzle,
// applied with `wrangler d1 migrations apply` (local and remote).
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	verbose: true,
	strict: true
});
