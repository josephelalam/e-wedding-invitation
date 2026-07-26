import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { updateEvent } from '$lib/server/services/events';
import { parseTheme, SECTION_IDS, type SectionId } from '$lib/themes/schema';
import { presets } from '$lib/themes/presets';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { event } = await parent();
	let theme;
	try {
		theme = parseTheme(event.theme);
	} catch {
		theme = parseTheme({});
	}
	return { theme, presetNames: Object.keys(presets) };
};

export const actions: Actions = {
	save: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();

		const applyPreset = String(form.get('applyPreset') ?? '');
		let theme;
		if (applyPreset && presets[applyPreset]) {
			// Preset click: replace look, keep the event's music + texts
			const current = parseTheme(JSON.parse(String(form.get('currentTheme') ?? '{}')));
			theme = {
				...presets[applyPreset],
				musicKey: current.musicKey,
				monogram: current.monogram,
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

			// One input per text; it renders for every language (owner request)
			const texts: Record<string, Record<string, string>> = {};
			for (const kind of ['welcome', 'closing'] as const) {
				const value = String(form.get(kind) ?? '').trim();
				if (value) texts[kind] = { en: value };
			}

			theme = {
				preset: String(form.get('preset') ?? 'custom') || 'custom',
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
	}
};
