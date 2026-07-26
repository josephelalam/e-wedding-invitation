import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { magicLink, twoFactor } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';
import { pbkdf2Hash, pbkdf2Verify } from '$lib/server/crypto';
import { deliverAuthLink } from '$lib/server/services/outbox';
import { resendSender } from '$lib/server/services/email';

// Spec §4.4 — three principals, three mechanisms:
//   guests: capability tokens (no account, handled outside auth entirely)
//   couples: magic links (15 min, single use), delivered via outbox/WhatsApp
//   owner: email+password (PBKDF2, Workers CPU budget) + TOTP
// Public sign-up is closed everywhere: this is a managed, owner-onboarded product.
export const createAuth = (d1: D1Database) => {
	const db = getDb(d1);
	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			password: {
				hash: pbkdf2Hash,
				verify: ({ hash, password }) => pbkdf2Verify(hash, password)
			}
		},
		user: {
			additionalFields: {
				role: { type: 'string', defaultValue: 'couple', input: false }
			}
		},
		plugins: [
			magicLink({
				expiresIn: 60 * 15,
				disableSignUp: true,
				sendMagicLink: async ({ email, url }) => {
					await deliverAuthLink(db, {
						kind: 'magic_link',
						email,
						url,
						send: resendSender(env.RESEND_API_KEY)
					});
				}
			}),
			twoFactor({ issuer: 'EInvite' }),
			sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
		]
	});
};

/**
 * DO NOT USE!
 *
 * This instance is used by the `better-auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
