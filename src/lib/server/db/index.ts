import { drizzle } from 'drizzle-orm/d1';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export const getDb = (d1: D1Database) => drizzle(d1, { schema });

// Services accept any SQLite drizzle instance so unit tests can run them
// against better-sqlite3 with the same migrations D1 uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = BaseSQLiteDatabase<'sync' | 'async', any, typeof schema>;
