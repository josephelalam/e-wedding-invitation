import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { updateEvent } from '$lib/server/services/events';
import { parseTheme, SECTION_IDS, TEMPLATE_IDS, type SectionId } from '$lib/themes/schema';
import { presets } from '$lib/themes/presets';
import { TEMPLATES } from '$lib/templates/registry';
import type { Actions, PageServerLoad } from './$types';

const TEXT_KINDS = ['welcome', 'closing', 'intro', 'parents', 'gifts', 'endCaption'] as const;

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
		const db = getDb(platform!.env.DB);
		const form = await request.formData();

		const applyPreset = String(form.get('applyPreset') ?? '');
		let theme;
		if (applyPreset && presets[applyPreset]) {
			// Preset click: replace the look, keep the event's own content
			const current = parseTheme(JSON.parse(String(form.get('currentTheme') ?? '{}')));
			theme = {
				...presets[applyPreset],
				template: current.template,
				musicKey: current.musicKey,
				monogram: current.monogram,
				images: current.images,
				videoKey: current.videoKey,
				effect: current.effect,
				rsvpDeadline: current.rsvpDeadline,
				giftsAccountLabel: current.giftsAccountLabel,
				giftsAccount: current.giftsAccount,
				texts: current.texts
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
			const images = String(form.get('images') ?? '')
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean);

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
				images,
				videoKey: String(form.get('videoKey') ?? '').trim() || null,
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
				error:
					'Theme rejected — colors must be #rrggbb, at least one slide must stay enabled, and image keys must look like theme/<event>/<file> (placed with wrangler, no upload).'
			});
		}
		return { saved: true };
	}
};
