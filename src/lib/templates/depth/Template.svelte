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
