import type { Component } from 'svelte';
import type { TemplateId } from '$lib/themes/schema';
import SlidesTemplate from './slides/Template.svelte';
import EdgesTemplate from './edges/Template.svelte';
import CinematicTemplate from './cinematic/Template.svelte';
import DepthTemplate from './depth/Template.svelte';
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
		name: 'Signature Deck',
		tagline:
			'Full-screen slides over a slow-breathing photo wall — monochrome ivory, script names, the market signature.',
		usesImages: true,
		component: SlidesTemplate
	},
	edges: {
		id: 'edges',
		name: 'Torn-Paper Story',
		tagline:
			'A formal scrolling story: verse, families, photos torn like paper between stationery cards, falling petals.',
		usesImages: true,
		component: EdgesTemplate
	},
	cinematic: {
		id: 'cinematic',
		name: 'Horizon — Sideways Story',
		tagline:
			'Swipe sideways through full-screen scenes over a breathing photo wall — formal invitation, countdown ledger, venues, a tilted polaroid finale.',
		usesImages: true,
		component: CinematicTemplate
	},
	depth: {
		id: 'depth',
		name: 'Depth — Parallax Story',
		tagline:
			'A continuous scroll with real depth: the photo wall drifts behind the words, each page settles in and recedes as you pass, photo bands breathe between them.',
		usesImages: true,
		component: DepthTemplate
	}
};
