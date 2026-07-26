import { sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import type { PageServerLoad } from './$types';

// The "my aunt swears she RSVP'd" settler (spec §4.13) — rendered as plain
// sentences, not raw audit codes.

type RawRow = {
	actor: string;
	action: string;
	entityId: string;
	at: string;
	meta: string | null;
};

type Meta = Record<string, unknown>;

function parseMeta(raw: string | null): Meta {
	if (!raw) return {};
	try {
		return JSON.parse(raw) as Meta;
	} catch {
		return {};
	}
}

function sentence(
	action: string,
	meta: Meta,
	guestLabel: string | null
): { icon: string; text: string } {
	switch (action) {
		case 'rsvp.submit':
			return meta.attending
				? { icon: '✅', text: `RSVP — confirmed ${meta.seats ?? '?'} seat(s)` }
				: { icon: '🚫', text: 'RSVP — declined' };
		case 'invitation.bulk_create':
			return { icon: '👥', text: `Imported ${meta.count ?? '?'} guest card(s)` };
		case 'invitation.revoke':
			return { icon: '🔒', text: `Revoked the card${guestLabel ? ` of ${guestLabel}` : ''}` };
		case 'invitation.unrevoke':
			return { icon: '🔓', text: `Re-activated the card${guestLabel ? ` of ${guestLabel}` : ''}` };
		case 'event.create':
			return { icon: '✨', text: 'Event created' };
		case 'event.update': {
			const fields = Array.isArray(meta.fields)
				? (meta.fields as string[]).filter((f) => f !== 'updatedAt').join(', ')
				: '';
			return { icon: '✏️', text: `Event details updated${fields ? ` (${fields})` : ''}` };
		}
		case 'event.status':
			return { icon: '🚦', text: `Event set to ${meta.to ?? '?'}` };
		case 'location.create':
			return { icon: '📍', text: 'Location stop added' };
		case 'location.update':
			return { icon: '📍', text: 'Location stop updated' };
		case 'location.delete':
			return { icon: '📍', text: 'Location stop removed' };
		case 'audio.upload': {
			const kb = typeof meta.bytes === 'number' ? ` (${Math.round(meta.bytes / 1024)} KB)` : '';
			return { icon: '🎵', text: `Music track uploaded${kb}` };
		}
		case 'audio.remove':
			return { icon: '🎵', text: 'Music track removed' };
		case 'export.csv':
			return { icon: '📄', text: 'Guest list exported (CSV)' };
		case 'couple.link':
			return { icon: '💍', text: 'Couple dashboard account created / linked' };
		case 'retention.purge':
			return { icon: '🧹', text: 'Guest data purged (retention policy)' };
		default:
			return { icon: '·', text: action };
	}
}

function who(actor: string, guestLabel: string | null, coupleName: string | null): string {
	if (actor.startsWith('guest:')) return guestLabel ?? 'A guest';
	if (actor.startsWith('couple:')) return coupleName ?? 'Couple';
	if (actor === 'system') return 'System';
	return 'Owner';
}

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);
	const rows = (await db.all(
		sql`SELECT actor, action, entity_id AS entityId, at, meta
		    FROM audit_log
		    WHERE (entity = 'event' AND entity_id = ${params.id})
		       OR (entity = 'invitation' AND entity_id IN (SELECT id FROM invitations WHERE event_id = ${params.id}))
		    ORDER BY at DESC
		    LIMIT 200`
	)) as RawRow[];

	const guestLabels = new Map<string, string>();
	for (const row of (await db.all(
		sql`SELECT id, guest_label AS label FROM invitations WHERE event_id = ${params.id}`
	)) as { id: string; label: string }[]) {
		guestLabels.set(row.id, row.label);
	}

	const coupleNames = new Map<string, string>();
	for (const row of (await db.all(
		sql`SELECT u.id, u.name FROM user u JOIN couples c ON c.user_id = u.id WHERE c.event_id = ${params.id}`
	)) as { id: string; name: string }[]) {
		coupleNames.set(row.id, row.name);
	}

	return {
		activity: rows.map((row) => {
			const meta = parseMeta(row.meta);
			const guestLabel =
				guestLabels.get(row.entityId) ?? guestLabels.get(row.actor.replace('guest:', '')) ?? null;
			const coupleName = coupleNames.get(row.actor.replace('couple:', '')) ?? null;
			return {
				at: row.at,
				who: who(row.actor, guestLabel, coupleName),
				...sentence(row.action, meta, guestLabel)
			};
		})
	};
};
