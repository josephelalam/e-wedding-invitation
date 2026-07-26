import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

// UptimeRobot target (spec §4.13): proves the Worker AND D1 answer.
export const GET: RequestHandler = async ({ platform, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		await getDb(platform!.env.DB).get(sql`SELECT 1`);
		return json({ ok: true });
	} catch {
		return json({ ok: false }, { status: 503 });
	}
};
