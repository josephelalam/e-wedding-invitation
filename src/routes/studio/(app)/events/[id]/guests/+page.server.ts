import { fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { invitations } from '$lib/server/db/schema';
import { parseGuestCsv } from '$lib/server/csv';
import { createInvitations } from '$lib/server/services/invitations';
import { createCoupleUser } from '$lib/server/services/users';
import { audit } from '$lib/server/services/audit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	const db = getDb(platform!.env.DB);
	const rows = await db
		.select()
		.from(invitations)
		.where(eq(invitations.eventId, params.id))
		.orderBy(asc(invitations.createdAt), asc(invitations.guestLabel));
	return { invitations: rows, origin: url.origin };
};

export const actions: Actions = {
	import: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const text = String((await request.formData()).get('csv') ?? '');
		if (!text.trim()) return fail(400, { importError: 'Paste at least one line.' });
		const { rows, errors } = parseGuestCsv(text);
		if (rows.length > 0) {
			await createInvitations(db, params.id, rows, `owner:${locals.user!.id}`);
		}
		return {
			imported: rows.length,
			importErrors: errors.map((e) => `line ${e.line}: ${e.message}`)
		};
	},
	revoke: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const revoked = String(form.get('revoked')) === 'true';
		if (!id) return fail(400, {});
		const scope = and(eq(invitations.id, id), eq(invitations.eventId, params.id));
		const [row] = await db.select({ id: invitations.id }).from(invitations).where(scope).limit(1);
		if (!row) return fail(404, {});
		await db.update(invitations).set({ revoked }).where(scope);
		await audit(
			db,
			`owner:${locals.user!.id}`,
			revoked ? 'invitation.revoke' : 'invitation.unrevoke',
			'invitation',
			id
		);
		return { saved: true };
	},
	coupleLogin: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const name = String(form.get('name') ?? '').trim() || 'Couple';
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
			return fail(400, { coupleError: 'Enter a valid email for the couple.' });
		}
		await createCoupleUser(db, { email, name, eventId: params.id });
		// Send through better-auth so the link is a real single-use magic link;
		// with no email provider it lands in the Outbox for WhatsApp forwarding.
		await locals.auth.api.signInMagicLink({
			body: { email, callbackURL: '/dash' },
			headers: request.headers
		});
		return {
			coupleLinked: `Couple account ready. The sign-in link for ${email} is waiting in the Outbox.`
		};
	}
};
