import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { invitations, rsvps } from '../db/schema';

// The couple dashboard's two indexed GROUP BY queries (spec §5) + CSV export.

export type EventStats = {
	cards: number;
	confirmedCards: number;
	declinedCards: number;
	pendingCards: number;
	confirmedSeats: number;
};

export async function eventStats(db: Db, eventId: string): Promise<EventStats> {
	const [row] = await db
		.select({
			cards: sql<number>`count(*)`,
			confirmedCards: sql<number>`coalesce(sum(case when ${rsvps.attending} = 1 then 1 else 0 end), 0)`,
			declinedCards: sql<number>`coalesce(sum(case when ${rsvps.attending} = 0 then 1 else 0 end), 0)`,
			confirmedSeats: sql<number>`coalesce(sum(case when ${rsvps.attending} = 1 then ${rsvps.confirmedSeats} else 0 end), 0)`
		})
		.from(invitations)
		.leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
		.where(eq(invitations.eventId, eventId));
	const cards = row?.cards ?? 0;
	const confirmedCards = row?.confirmedCards ?? 0;
	const declinedCards = row?.declinedCards ?? 0;
	return {
		cards,
		confirmedCards,
		declinedCards,
		pendingCards: cards - confirmedCards - declinedCards,
		confirmedSeats: row?.confirmedSeats ?? 0
	};
}

export type RsvpStatus = 'confirmed' | 'declined' | 'pending';

export type RsvpTableRow = {
	invitationId: string;
	token: string;
	guestLabel: string;
	maxSeats: number;
	status: RsvpStatus;
	confirmedSeats: number | null;
	note: string | null;
	phone: string | null;
	lang: string | null;
	groupTag: string | null;
	answeredAt: string | null;
	revoked: boolean;
};

export async function rsvpRows(
	db: Db,
	eventId: string,
	filter: { status?: RsvpStatus; q?: string } = {}
): Promise<RsvpTableRow[]> {
	const conditions = [eq(invitations.eventId, eventId)];
	if (filter.status === 'confirmed') conditions.push(eq(rsvps.attending, true));
	if (filter.status === 'declined') conditions.push(eq(rsvps.attending, false));
	if (filter.status === 'pending') conditions.push(sql`${rsvps.invitationId} IS NULL`);
	if (filter.q) {
		conditions.push(
			sql`lower(${invitations.guestLabel}) LIKE ${'%' + filter.q.toLowerCase() + '%'}`
		);
	}
	const rows = await db
		.select({ invitation: invitations, rsvp: rsvps })
		.from(invitations)
		.leftJoin(rsvps, eq(rsvps.invitationId, invitations.id))
		.where(and(...conditions))
		.orderBy(sql`${invitations.guestLabel} COLLATE NOCASE`);
	return rows.map(({ invitation, rsvp }) => ({
		invitationId: invitation.id,
		token: invitation.token,
		guestLabel: invitation.guestLabel,
		maxSeats: invitation.maxSeats,
		status: rsvp === null ? 'pending' : rsvp.attending ? 'confirmed' : 'declined',
		confirmedSeats: rsvp?.confirmedSeats ?? null,
		note: rsvp?.note ?? null,
		phone: invitation.phone,
		lang: invitation.lang,
		groupTag: invitation.groupTag,
		answeredAt: rsvp?.updatedAt ?? null,
		revoked: invitation.revoked
	}));
}

const CSV_HEADER = [
	'guest_label',
	'max_seats',
	'status',
	'confirmed_seats',
	'note',
	'phone',
	'lang',
	'group_tag',
	'answered_at'
] as const;

function csvField(value: string | number | null): string {
	const text = value === null ? '' : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** UTF-8 BOM + CRLF: the combination that makes Excel open Arabic names correctly. */
export function toCsv(rows: RsvpTableRow[]): string {
	const lines = [CSV_HEADER.join(',')];
	for (const row of rows) {
		lines.push(
			[
				csvField(row.guestLabel),
				csvField(row.maxSeats),
				csvField(row.status),
				csvField(row.confirmedSeats),
				csvField(row.note),
				csvField(row.phone),
				csvField(row.lang),
				csvField(row.groupTag),
				csvField(row.answeredAt)
			].join(',')
		);
	}
	return '﻿' + lines.join('\r\n') + '\r\n';
}
