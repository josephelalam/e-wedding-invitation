import { desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { outbox } from '../db/schema';
import { newId } from '../crypto';

export type DeliverAuthLinkInput = {
	kind: 'magic_link';
	email: string;
	url: string;
	eventId?: string | null;
	/** Optional email transport (e.g. Resend when a key is configured). */
	send?: (email: string, url: string) => Promise<void>;
};

/**
 * $0-tier delivery: the link always lands in the outbox so the owner can
 * forward it over WhatsApp (spec §4.4 "emailed/WhatsApp-forwarded sign-in
 * link"); an email transport, when configured, is a bonus — never a gate.
 */
export async function deliverAuthLink(db: Db, input: DeliverAuthLinkInput): Promise<void> {
	await db.insert(outbox).values({
		id: newId(),
		kind: input.kind,
		recipient: input.email,
		url: input.url,
		eventId: input.eventId ?? null,
		createdAt: new Date().toISOString(),
		consumedAt: null
	});
	if (input.send) {
		try {
			await input.send(input.email, input.url);
		} catch (err) {
			console.error('outbox: email transport failed, link still available in studio', err);
		}
	}
}

export async function pendingLinks(db: Db) {
	return db
		.select()
		.from(outbox)
		.where(isNull(outbox.consumedAt))
		.orderBy(desc(outbox.createdAt), desc(sql`rowid`))
		.limit(50);
}

export async function markConsumed(db: Db, id: string): Promise<void> {
	await db.update(outbox).set({ consumedAt: new Date().toISOString() }).where(eq(outbox.id, id));
}
