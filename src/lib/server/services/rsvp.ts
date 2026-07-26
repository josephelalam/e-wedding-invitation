import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { events, invitations, rsvps } from '../db/schema';
import { audit } from './audit';

export type RsvpError = 'not_found' | 'revoked' | 'not_live' | 'seats_exceed_allowance' | 'invalid';

export type SubmitRsvpInput = {
	token: string;
	attending: boolean;
	seats: number;
	note?: string | null;
};

export type RsvpRow = {
	attending: boolean;
	confirmedSeats: number;
	note: string | null;
	updatedAt: string;
};

export type SubmitRsvpResult = { ok: true; rsvp: RsvpRow } | { ok: false; error: RsvpError };

async function findByToken(db: Db, token: string) {
	const [row] = await db
		.select({ invitation: invitations, eventStatus: events.status })
		.from(invitations)
		.innerJoin(events, eq(invitations.eventId, events.id))
		.where(eq(invitations.token, token))
		.limit(1);
	return row ?? null;
}

/** One card = one authoritative answer: re-submitting upserts, never duplicates. */
export async function submitRsvp(db: Db, input: SubmitRsvpInput): Promise<SubmitRsvpResult> {
	const found = await findByToken(db, input.token);
	if (!found) return { ok: false, error: 'not_found' };
	const { invitation, eventStatus } = found;
	if (invitation.revoked) return { ok: false, error: 'revoked' };
	if (eventStatus !== 'live') return { ok: false, error: 'not_live' };

	const seats = input.attending ? input.seats : 0;
	if (!Number.isInteger(seats) || (input.attending && seats < 1)) {
		return { ok: false, error: 'invalid' };
	}
	if (seats > invitation.maxSeats) return { ok: false, error: 'seats_exceed_allowance' };

	const rsvp: RsvpRow = {
		attending: input.attending,
		confirmedSeats: seats,
		note: input.note ? input.note.slice(0, 500) : null,
		updatedAt: new Date().toISOString()
	};
	await db
		.insert(rsvps)
		.values({ invitationId: invitation.id, ...rsvp })
		.onConflictDoUpdate({ target: rsvps.invitationId, set: rsvp });
	await audit(db, `guest:${invitation.id}`, 'rsvp.submit', 'invitation', invitation.id, {
		attending: rsvp.attending,
		seats: rsvp.confirmedSeats
	});
	return { ok: true, rsvp };
}

export type RsvpState = {
	guestLabel: string;
	maxSeats: number;
	lang: string | null;
	rsvp: RsvpRow | null;
};

/** Current answer for a card — powers the client-side hydration of cached pages. */
export async function getRsvpState(db: Db, token: string): Promise<RsvpState | null> {
	const [row] = await db
		.select({ invitation: invitations, rsvp: rsvps })
		.from(invitations)
		.leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
		.where(eq(invitations.token, token))
		.limit(1);
	if (!row || row.invitation.revoked) return null;
	return {
		guestLabel: row.invitation.guestLabel,
		maxSeats: row.invitation.maxSeats,
		lang: row.invitation.lang,
		rsvp: row.rsvp
			? {
					attending: row.rsvp.attending,
					confirmedSeats: row.rsvp.confirmedSeats,
					note: row.rsvp.note,
					updatedAt: row.rsvp.updatedAt
				}
			: null
	};
}
