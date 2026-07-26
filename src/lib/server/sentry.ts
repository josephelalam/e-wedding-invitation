// Sentry-compatible error capture with zero SDK bytes (deviation from spec
// §4.13 recorded in the runbook: the envelope API is the same Sentry account
// and alerting, without shipping a client SDK to guests on 4G).

type ParsedDsn = { endpoint: string; publicKey: string };

export function parseDsn(dsn: string | undefined): ParsedDsn | null {
	if (!dsn) return null;
	try {
		const url = new URL(dsn);
		const projectId = url.pathname.replace(/^\//, '');
		if (!url.username || !projectId) return null;
		return {
			endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
			publicKey: url.username
		};
	} catch {
		return null;
	}
}

export type CaptureContext = {
	dsn: string | undefined;
	release?: string;
	url?: string;
	source: 'server' | 'client';
};

/** Fire-and-forget: error reporting must never delay or fail a wedding page. */
export async function captureError(
	context: CaptureContext,
	error: unknown,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const parsed = parseDsn(context.dsn);
	if (!parsed) return;
	const err = error instanceof Error ? error : new Error(String(error));
	const eventId = crypto.randomUUID().replaceAll('-', '');
	const timestamp = new Date().toISOString();
	const event = {
		event_id: eventId,
		timestamp,
		platform: 'javascript',
		level: 'error',
		release: context.release,
		tags: { source: context.source },
		request: context.url ? { url: context.url } : undefined,
		exception: {
			values: [
				{
					type: err.name,
					value: err.message.slice(0, 1000),
					stacktrace: err.stack
						? { frames: [{ function: err.stack.split('\n').slice(1, 6).join(' | ') }] }
						: undefined
				}
			]
		}
	};
	const envelope =
		JSON.stringify({
			event_id: eventId,
			sent_at: timestamp,
			sdk: { name: 'einvite.lite', version: '1.0.0' }
		}) +
		'\n' +
		JSON.stringify({ type: 'event' }) +
		'\n' +
		JSON.stringify(event) +
		'\n';
	try {
		await fetcher(parsed.endpoint, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-sentry-envelope',
				'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=einvite.lite/1.0.0`
			},
			body: envelope
		});
	} catch {
		// swallow — see function contract
	}
}
