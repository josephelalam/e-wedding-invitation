import { getDb } from '$lib/server/db';
import { requireEventAccess } from '$lib/server/guards';
import { rsvpRows, toCsv } from '$lib/server/services/export';
import { audit } from '$lib/server/services/audit';
import type { RequestHandler } from './$types';

// Owner or that event's couple only (guards throw 403 otherwise).
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	const db = getDb(platform!.env.DB);
	const user = await requireEventAccess(db, locals, params.id);
	const csv = toCsv(await rsvpRows(db, params.id));
	await audit(db, `${user.role}:${user.id}`, 'export.csv', 'event', params.id);
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="rsvps-${params.id}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
