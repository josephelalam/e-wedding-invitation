import type { Component } from 'svelte';
import type { TemplateId } from '$lib/themes/schema';
import SlidesTemplate from './slides/Template.svelte';
import EdgesTemplate from './edges/Template.svelte';
import CinematicTemplate from './cinematic/Template.svelte';
import type { TemplateProps } from './types';

// The module registry (owner goal: keep adding layouts over time).
// Adding a module: create src/lib/templates/<id>/Template.svelte implementing
// TemplateProps, add the id to TEMPLATE_IDS in themes/schema.ts, register here.
export type TemplateMeta = {
	id: TemplateId;
	name: string;
	tagline: string;
	usesImages: boolean;
	component: Component<TemplateProps>;
};

export const TEMPLATES: Record<TemplateId, TemplateMeta> = {
	slides: {
		id: 'slides',
		name: 'Envelope & Slides',
		tagline: 'Cover opens with music into full-screen swipeable slides — the classic.',
		usesImages: false,
		component: SlidesTemplate
	},
	edges: {
		id: 'edges',
		name: 'Torn-Paper Story',
		tagline: 'A long scrolling story: photos with torn-paper edges between elegant cards.',
		usesImages: true,
		component: EdgesTemplate
	},
	cinematic: {
		id: 'cinematic',
		name: 'Cinematic Reveal',
		tagline: 'A loading curtain, a full-bleed photo hero, sections that fade in as you scroll.',
		usesImages: true,
		component: CinematicTemplate
	}
};
