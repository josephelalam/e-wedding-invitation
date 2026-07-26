import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { createOwner, ownerExists } from '$lib/server/services/users';
import type { Actions, PageServerLoad } from './$types';

// One-shot owner bootstrap: requires the SETUP_TOKEN secret, disappears
// forever once an owner exists (spec §4.4 — the owner account gets real protection).
const SetupSchema = z.object({
	name: z.string().trim().min(1).max(100),
	email: z.email(),
	password: z.string().min(12).max(200)
});

async function assertSetupAllowed(platform: App.Platform | undefined, token: string | null) {
	const setupToken = env.SETUP_TOKEN;
	if (!setupToken || !token || token !== setupToken) throw error(404, 'Not found');
	const db = getDb(platform!.env.DB);
	if (await ownerExists(db)) throw error(404, 'Not found');
	return db;
}

export const load: PageServerLoad = async ({ platform, url }) => {
	await assertSetupAllowed(platform, url.searchParams.get('token'));
	return {};
};

export const actions: Actions = {
	default: async ({ platform, url, request }) => {
		const db = await assertSetupAllowed(platform, url.searchParams.get('token'));
		const form = Object.fromEntries(await request.formData());
		const parsed = SetupSchema.safeParse(form);
		if (!parsed.success) {
			return fail(400, {
				error: 'Please provide a name, a valid email and a password of at least 12 characters.'
			});
		}
		await createOwner(db, parsed.data);
		redirect(303, '/studio/login?setup=done');
	}
};
