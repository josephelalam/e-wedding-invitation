export type TurnstileResult = { ok: boolean; skipped?: boolean };

/**
 * Invisible bot check on RSVP writes (spec §7.2). Env-gated: with no secret
 * configured the check is skipped (rate limits still apply); with a secret it
 * fails closed — on missing tokens and on verifier outages alike.
 */
export async function verifyTurnstile(
	secret: string | undefined,
	token: string | null,
	remoteIp?: string,
	fetcher: typeof fetch = fetch
): Promise<TurnstileResult> {
	if (!secret) return { ok: true, skipped: true };
	if (!token) return { ok: false };
	try {
		const body = new URLSearchParams({ secret, response: token });
		if (remoteIp) body.set('remoteip', remoteIp);
		const res = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body
		});
		if (!res.ok) return { ok: false };
		const json = (await res.json()) as { success?: boolean };
		return { ok: json.success === true };
	} catch {
		return { ok: false };
	}
}
