import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, type Db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { updateEvent } from '$lib/server/services/events';
import { requireOwner } from '$lib/server/guards';
import {
	parseTheme,
	SECTION_IDS,
	TEMPLATE_IDS,
	type SectionId,
	type Theme
} from '$lib/themes/schema';
import { presets } from '$lib/themes/presets';
import { TEMPLATES } from '$lib/templates/registry';
import type { Actions, PageServerLoad } from './$types';

const TEXT_KINDS = ['welcome', 'closing', 'intro', 'parents', 'gifts', 'endCaption'] as const;

// Owner-uploaded media (policy 2026-07-28: uploads live in the studio only —
// guests and couples never get a file input).
const IMAGE_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/svg+xml': 'svg'
};
const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_IMAGES = 12;

async function loadEventTheme(db: Db, id: string) {
	const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
	if (!event) return null;
	let theme: Theme;
	try {
		theme = parseTheme(event.theme);
	} catch {
		theme = parseTheme({});
	}
	return { event, theme };
}

function mediaName(fileName: string, extension: string): string {
	const base =
		fileName
			.replace(/\.[^.]*$/, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'photo';
	return `${Date.now().toString(36)}-${base}.${extension}`;
}

/** Delete an R2 object, but only ever inside this event's own theme folder. */
async function deleteOwn(bucket: R2Bucket, slug: string, key: string | null) {
	if (key && key.startsWith(`theme/${slug}/`)) {
		try {
			await bucket.delete(key);
		} catch {
			// a missing object is fine — the theme reference is what matters
		}
	}
}

export const load: PageServerLoad = async ({ parent }) => {
	const { event } = await parent();
	let theme;
	try {
		theme = parseTheme(event.theme);
	} catch {
		theme = parseTheme({});
	}
	return {
		theme,
		presetNames: Object.keys(presets),
		templates: Object.values(TEMPLATES).map(({ id, name, tagline, usesImages }) => ({
			id,
			name,
			tagline,
			usesImages
		}))
	};
};

export const actions: Actions = {
	save: async ({ params, platform, request, locals }) => {
		requireOwner(locals);
		const db = getDb(platform!.env.DB);
		const current = await loadEventTheme(db, params.id);
		if (!current) return fail(404, { error: 'No such event.' });
		const form = await request.formData();

		// Media is managed by the upload actions — a save never touches it.
		const media = { images: current.theme.images, videoKey: current.theme.videoKey };

		const applyPreset = String(form.get('applyPreset') ?? '');
		let theme;
		if (applyPreset && presets[applyPreset]) {
			// Preset click: replace the look, keep the event's own content
			theme = {
				...presets[applyPreset],
				template: current.theme.template,
				musicKey: current.theme.musicKey,
				monogram: current.theme.monogram,
				...media,
				effect: current.theme.effect,
				rsvpDeadline: current.theme.rsvpDeadline,
				giftsAccountLabel: current.theme.giftsAccountLabel,
				giftsAccount: current.theme.giftsAccount,
				texts: current.theme.texts
			};
		} else {
			const ordered = SECTION_IDS.map((section) => ({
				section,
				enabled: form.get(`slide-${section}`) === 'on',
				order: Number(form.get(`order-${section}`) ?? 99)
			}))
				.filter((s) => s.enabled)
				.sort((a, b) => a.order - b.order)
				.map((s) => s.section as SectionId);

			// Per-language texts; missing languages fall back to whichever is filled
			const texts: Record<string, Record<string, string>> = {};
			for (const kind of TEXT_KINDS) {
				for (const code of ['en', 'ar', 'fr'] as const) {
					const value = String(form.get(`${kind}-${code}`) ?? '').trim();
					if (value) {
						texts[kind] = texts[kind] ?? {};
						texts[kind][code] = value;
					}
				}
			}

			const templateRaw = String(form.get('template') ?? 'slides');
			theme = {
				preset: String(form.get('preset') ?? 'custom') || 'custom',
				template: (TEMPLATE_IDS as readonly string[]).includes(templateRaw)
					? templateRaw
					: 'slides',
				colors: {
					bg: String(form.get('bg') ?? ''),
					text: String(form.get('text') ?? ''),
					accent: String(form.get('accent') ?? ''),
					muted: String(form.get('muted') ?? '')
				},
				fonts: {
					display: String(form.get('fontDisplay') ?? ''),
					body: String(form.get('fontBody') ?? '')
				},
				slideOrder: ordered,
				musicKey: String(form.get('musicKey') ?? '') || null,
				monogram: String(form.get('monogram') ?? '').trim() || null,
				...media,
				effect: String(form.get('effect') ?? 'none') || 'none',
				rsvpDeadline: String(form.get('rsvpDeadline') ?? '').trim() || null,
				giftsAccountLabel: String(form.get('giftsAccountLabel') ?? '').trim() || null,
				giftsAccount: String(form.get('giftsAccount') ?? '').trim() || null,
				texts
			};
		}

		const result = await updateEvent(db, params.id, { theme }, `owner:${locals.user!.id}`);
		if (!result.ok) {
			return fail(400, {
				error: 'Theme rejected — colors must be #rrggbb and at least one slide must stay enabled.'
			});
		}
		return { saved: true };
	},

	uploadPhotos: async ({ params, platform, request, locals }) => {
		requireOwner(locals);
		const db = getDb(platform!.env.DB);
		const current = await loadEventTheme(db, params.id);
		if (!current) return fail(404, { mediaError: 'No such event.' });

		const form = await request.formData();
		const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
		if (files.length === 0) return fail(400, { mediaError: 'Choose at least one image first.' });
		if (current.theme.images.length + files.length > MAX_IMAGES) {
			return fail(400, {
				mediaError: `An event carries up to ${MAX_IMAGES} photos — remove some before adding ${files.length} more.`
			});
		}
		for (const file of files) {
			if (!IMAGE_TYPES[file.type]) {
				return fail(400, {
					mediaError: `"${file.name}" isn't a supported image (JPG, PNG, WebP).`
				});
			}
			if (file.size > MAX_IMAGE_BYTES) {
				return fail(400, { mediaError: `"${file.name}" is over 8 MB — export it smaller.` });
			}
		}

		const bucket = platform!.env.MEDIA;
		const keys: string[] = [];
		for (const file of files) {
			const key = `theme/${current.event.slug}/${mediaName(file.name, IMAGE_TYPES[file.type])}`;
			await bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type }
			});
			keys.push(key);
		}

		const theme = { ...current.theme, images: [...current.theme.images, ...keys] };
		const result = await updateEvent(db, params.id, { theme }, `owner:${locals.user!.id}`);
		if (!result.ok) return fail(400, { mediaError: 'Could not save the uploaded photos.' });
		return { mediaSaved: `${keys.length} photo${keys.length === 1 ? '' : 's'} uploaded.` };
	},

	removeImage: async ({ params, platform, request, locals }) => {
		requireOwner(locals);
		const db = getDb(platform!.env.DB);
		const current = await loadEventTheme(db, params.id);
		if (!current) return fail(404, { mediaError: 'No such event.' });
		const key = String((await request.formData()).get('key') ?? '');
		if (!current.theme.images.includes(key)) return fail(400, { mediaError: 'Unknown photo.' });

		const theme = { ...current.theme, images: current.theme.images.filter((k) => k !== key) };
		const result = await updateEvent(db, params.id, { theme }, `owner:${locals.user!.id}`);
		if (!result.ok) return fail(400, { mediaError: 'Could not remove the photo.' });
		await deleteOwn(platform!.env.MEDIA, current.event.slug, key);
		return { mediaSaved: 'Photo removed.' };
	},

	moveImage: async ({ params, platform, request, locals }) => {
		requireOwner(locals);
		const db = getDb(platform!.env.DB);
		const current = await loadEventTheme(db, params.id);
		if (!current) return fail(404, { mediaError: 'No such event.' });
		const form = await request.formData();
		const key = String(form.get('key') ?? '');
		const direction = String(form.get('dir') ?? '') === 'back' ? -1 : 1;
		const images = [...current.theme.images];
		const index = images.indexOf(key);
		const target = index + direction;
		if (index === -1 || target < 0 || target >= images.length) return { mediaSaved: '' };
		[images[index], images[target]] = [images[target], images[index]];

		const result = await updateEvent(
			db,
			params.id,
			{ theme: { ...current.theme, images } },
			`owner:${locals.user!.id}`
		);
		if (!result.ok) return fail(400, { mediaError: 'Could not reorder.' });
		return { mediaSaved: '' };
	},

	uploadVideo: async ({ params, platform, request, locals }) => {
		requireOwner(locals);
		const db = getDb(platform!.env.DB);
		const current = await loadEventTheme(db, params.id);
		if (!current) return fail(404, { mediaError: 'No such event.' });

		const form = await request.formData();
		const file = form.get('video');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { mediaError: 'Choose a video first.' });
		}
		if (!VIDEO_TYPES[file.type]) {
			return fail(400, { mediaError: 'The background video must be an MP4 or WebM file.' });
		}
		if (file.size > MAX_VIDEO_BYTES) {
			return fail(400, { mediaError: 'The video is over 30 MB — compress it (see the tips).' });
		}

		const bucket = platform!.env.MEDIA;
		const key = `theme/${current.event.slug}/${mediaName(file.name, VIDEO_TYPES[file.type])}`;
		await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

		const previous = current.theme.videoKey;
		const result = await updateEvent(
			db,
			params.id,
			{ theme: { ...current.theme, videoKey: key } },
			`owner:${locals.user!.id}`
		);
		if (!result.ok) return fail(400, { mediaError: 'Could not save the video.' });
		if (previous !== key) await deleteOwn(bucket, current.event.slug, previous);
		return { mediaSaved: 'Background video uploaded.' };
	},

	removeVideo: async ({ params, platform, locals }) => {
		requireOwner(locals);
		const db = getDb(platform!.env.DB);
		const current = await loadEventTheme(db, params.id);
		if (!current) return fail(404, { mediaError: 'No such event.' });

		const previous = current.theme.videoKey;
		const result = await updateEvent(
			db,
			params.id,
			{ theme: { ...current.theme, videoKey: null } },
			`owner:${locals.user!.id}`
		);
		if (!result.ok) return fail(400, { mediaError: 'Could not remove the video.' });
		await deleteOwn(platform!.env.MEDIA, current.event.slug, previous);
		return { mediaSaved: 'Background video removed.' };
	}
};
