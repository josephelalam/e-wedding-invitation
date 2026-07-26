/**
 * Optional email transport. Returns undefined when no key is configured —
 * the $0 default — so callers fall back to outbox-only delivery.
 */
export function resendSender(
	apiKey: string | undefined
): ((email: string, url: string) => Promise<void>) | undefined {
	if (!apiKey) return undefined;
	return async (email, url) => {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: 'EInvite <onboarding@resend.dev>',
				to: [email],
				subject: 'Your sign-in link',
				text: `Sign in here (valid 15 minutes): ${url}`
			})
		});
		if (!res.ok) throw new Error(`resend: ${res.status} ${await res.text()}`);
	};
}
