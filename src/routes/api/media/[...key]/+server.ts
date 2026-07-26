import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Streams the event's music track from R2 through the Worker with immutable
// caching (spec §3.1.5). Only the audio/ prefix is reachable: the same bucket
// also holds nightly backups, which must never be publicly addressable.
export const GET: RequestHandler = async ({ params, platform, request }) => {
	const key = params.key;
	if (!key.startsWith('audio/') || key.includes('..')) throw error(404, 'not found');
	const bucket = platform?.env?.MEDIA;
	if (!bucket) throw error(404, 'not found');

	const rangeHeader = request.headers.get('range');
	const baseHeaders: Record<string, string> = {
		'accept-ranges': 'bytes',
		'cache-control': 'public, max-age=31536000, immutable'
	};

	if (rangeHeader) {
		const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
		if (match && (match[1] !== '' || match[2] !== '')) {
			const head = await bucket.head(key);
			if (!head) throw error(404, 'not found');
			const size = head.size;
			let start: number;
			let end: number;
			if (match[1] === '') {
				// suffix range: last N bytes
				const suffix = Math.min(Number(match[2]), size);
				start = size - suffix;
				end = size - 1;
			} else {
				start = Number(match[1]);
				end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
			}
			if (start > end || start >= size) {
				return new Response(null, {
					status: 416,
					headers: { 'content-range': `bytes */${size}` }
				});
			}
			const object = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
			if (!object) throw error(404, 'not found');
			return new Response(object.body, {
				status: 206,
				headers: {
					...baseHeaders,
					'content-type': object.httpMetadata?.contentType ?? 'audio/mpeg',
					'content-length': String(end - start + 1),
					'content-range': `bytes ${start}-${end}/${size}`,
					etag: object.httpEtag
				}
			});
		}
	}

	const object = await bucket.get(key);
	if (!object) throw error(404, 'not found');
	return new Response(object.body, {
		headers: {
			...baseHeaders,
			'content-type': object.httpMetadata?.contentType ?? 'audio/mpeg',
			'content-length': String(object.size),
			etag: object.httpEtag
		}
	});
};
