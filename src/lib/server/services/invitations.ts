import type { Db } from '../db';
import { invitations } from '../db/schema';
import { generateToken, newId } from '../crypto';
import { audit } from './audit';

export type NewInvitationRow = {
	guestLabel: string;
	maxSeats: number;
	phone?: string | null;
	lang?: string | null;
	groupTag?: string | null;
};

// D1 caps bound parameters per statement; 10 rows × 9 columns stays well under.
const CHUNK = 10;

export async function createInvitations(
	db: Db,
	eventId: string,
	rows: NewInvitationRow[],
	actor = 'owner'
) {
	const createdAt = new Date().toISOString();
	const values = rows.map((row) => ({
		id: newId(),
		eventId,
		token: generateToken(),
		guestLabel: row.guestLabel,
		maxSeats: row.maxSeats,
		phone: row.phone ?? null,
		lang: row.lang ?? null,
		groupTag: row.groupTag ?? null,
		revoked: false,
		createdAt
	}));
	for (let i = 0; i < values.length; i += CHUNK) {
		await db.insert(invitations).values(values.slice(i, i + CHUNK));
	}
	if (values.length > 0) {
		await audit(db, actor, 'invitation.bulk_create', 'event', eventId, { count: values.length });
	}
	return values;
}
