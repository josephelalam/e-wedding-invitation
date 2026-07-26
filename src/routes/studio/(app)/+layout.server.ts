import { redirect } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Logged-out visitors get the login page; 403 is only for wrong-role sessions
	if (!locals.user) redirect(303, '/studio/login');
	requireOwner(locals);
	return {
		owner: {
			name: locals.user!.name,
			email: locals.user!.email,
			twoFactorEnabled: Boolean(locals.user!.twoFactorEnabled)
		}
	};
};
