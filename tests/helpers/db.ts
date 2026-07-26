import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../src/lib/server/db/schema';

export type TestDb = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_DIR = join(import.meta.dirname, '../../drizzle');

/**
 * In-memory SQLite running the exact same plain-SQL migrations D1 runs,
 * so unit tests exercise real CHECK constraints, triggers and FKs.
 */
export function testDb(): { db: TestDb; sqlite: Database.Database } {
	const sqlite = new Database(':memory:');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	if (files.length === 0) throw new Error('no migrations found in drizzle/');
	for (const file of files) {
		sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
	}
	const db = drizzle(sqlite, { schema });
	return { db, sqlite };
}
