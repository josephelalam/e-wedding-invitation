import { requireOwner } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	requireOwner(locals);
	return {
		owner: {
			name: locals.user!.name,
			email: locals.user!.email,
			twoFactorEnabled: Boolean(locals.user!.twoFactorEnabled)
		}
	};
};
