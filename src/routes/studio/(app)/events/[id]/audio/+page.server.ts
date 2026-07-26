import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { updateEvent } from '$lib/server/services/events';
import { audit } from '$lib/server/services/audit';
import { parseTheme, type Theme } from '$lib/themes/schema';
import type { Actions, PageServerLoad } from './$types';

// The ONLY upload control in the entire system (hard constraint #1):
// one music track per event, audio only, never photos.

const MAX_BYTES = 8 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/mp4': 'm4a',
	'audio/aac': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/ogg': 'ogg'
};

async function currentTheme(db: ReturnType<typeof getDb>, eventId: string): Promise<Theme> {
	const [row] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	try {
		return parseTheme(row?.theme ?? {});
	} catch {
		return parseTheme({});
	}
}

export const load: PageServerLoad = async ({ parent }) => {
	const { event } = await parent();
	try {
		return { musicKey: parseTheme(event.theme).musicKey };
	} catch {
		return { musicKey: null };
	}
};

export const actions: Actions = {
	upload: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();
		const file = form.get('track');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose an audio file first.' });
		}
		const ext = EXT_BY_TYPE[file.type];
		if (!ext) return fail(400, { error: 'Audio only (MP3, AAC/M4A, WAV or OGG).' });
		if (file.size > MAX_BYTES) {
			return fail(400, { error: 'Keep the track under 8 MB (~4 minutes of 128 kbps MP3).' });
		}

		const key = `audio/${params.id}.${ext}`;
		await platform!.env.MEDIA.put(key, file.stream(), {
			httpMetadata: { contentType: file.type }
		});

		const theme = await currentTheme(db, params.id);
		const result = await updateEvent(
			db,
			params.id,
			{ theme: { ...theme, musicKey: key } },
			`owner:${locals.user!.id}`
		);
		if (!result.ok) return fail(400, { error: 'Track stored but theme update failed — retry.' });
		await audit(db, `owner:${locals.user!.id}`, 'audio.upload', 'event', params.id, {
			key,
			bytes: file.size,
			type: file.type
		});
		return { saved: true };
	},
	remove: async ({ params, platform, locals }) => {
		const db = getDb(platform!.env.DB);
		const theme = await currentTheme(db, params.id);
		if (theme.musicKey) {
			await platform!.env.MEDIA.delete(theme.musicKey);
			await updateEvent(
				db,
				params.id,
				{ theme: { ...theme, musicKey: null } },
				`owner:${locals.user!.id}`
			);
			await audit(db, `owner:${locals.user!.id}`, 'audio.remove', 'event', params.id, {
				key: theme.musicKey
			});
		}
		return { saved: true };
	}
};
