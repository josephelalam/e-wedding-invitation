<script lang="ts">
	import Cover from '$lib/components/sections/Cover.svelte';
	import ScrollBody from '$lib/templates/shared/ScrollBody.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "depth" — a continuous scroll (no snap) so motion tracks the
	// guest's finger: a fixed photo plane drifting behind a content column,
	// each section settling in and receding out on its own progress.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();
</script>

<!-- `opened` is false on the server too, so the lock must be present from the
     very first SSR byte — gating it on a post-hydration `mounted` flag left a
     window (first paint to JS-ready) where the body was scrollable, and the
     lock snapping on mid-scroll yanked the guest back to the cover. The only
     guest who needs an escape hatch is one with no JS to ever fire `onopen`,
     and `<noscript>` targets exactly that case with no timing window at all. -->
<div class="depth" class:locked={!opened}>
	<Cover
		title={ctx.title}
		dateParts={ctx.dateParts}
		greeting={t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}
		openLabel={t(ctx.lang, 'cover.open')}
		monogram={ctx.monogram}
		{opened}
		{onopen}
	/>

	<ScrollBody {data} {ctx} {currentRsvp} {errorKey} {preview} />
</div>

<noscript>
	<style>
		/* No-JS guests can never fire `onopen`, so the SSR-immediate lock above
		   would trap them behind the cover forever — this is their only way in.
		   `!important` is required: Svelte scopes `.depth.locked` with its own
		   hash class (e.g. `.depth.locked.svelte-abc123`), three selectors deep,
		   so a plain `.locked` rule here would lose the specificity fight. */
		.depth.locked {
			height: auto !important;
			overflow: visible !important;
		}
	</style>
</noscript>

<style>
	.depth {
		position: relative;
	}

	/* Everything below the cover stays out of reach until the open gesture
	   (which is also the audio unlock) — same convention as the deck layouts. */
	.depth.locked {
		height: 100svh;
		overflow: hidden;
	}
</style>
