import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { rateLimits } from './db/schema';

export type RateLimitResult = { allowed: boolean; retryAfterSec?: number };

/**
 * Fixed-window counter in D1 — one atomic upsert per check. At this product's
 * write volume (~500 RSVPs on the busiest day) a cache server would be pure
 * ceremony (spec §4.7); a table is observable and free.
 */
export async function rateLimit(
	db: Db,
	key: string,
	opts: { limit: number; windowSec: number; now?: number }
): Promise<RateLimitResult> {
	const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
	const resetAt = nowSec + opts.windowSec;
	const [row] = await db
		.insert(rateLimits)
		.values({ key, count: 1, resetAt })
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`CASE WHEN ${rateLimits.resetAt} <= ${nowSec} THEN 1 ELSE ${rateLimits.count} + 1 END`,
				resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${nowSec} THEN ${resetAt} ELSE ${rateLimits.resetAt} END`
			}
		})
		.returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
	if (!row) return { allowed: false, retryAfterSec: opts.windowSec };
	if (row.count > opts.limit) {
		return { allowed: false, retryAfterSec: Math.max(1, row.resetAt - nowSec) };
	}
	return { allowed: true };
}
