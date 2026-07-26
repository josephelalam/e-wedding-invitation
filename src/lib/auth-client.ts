import { createAuthClient } from 'better-auth/svelte';
import { magicLinkClient, twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [
		magicLinkClient(),
		twoFactorClient({
			onTwoFactorRedirect() {
				window.location.href = '/studio/login/totp';
			}
		})
	]
});
