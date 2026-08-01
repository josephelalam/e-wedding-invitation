<script lang="ts">
	import { onMount } from 'svelte';
	import Envelope from '$lib/templates/shared/Envelope.svelte';
	import ScrollBody from '$lib/templates/shared/ScrollBody.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "overture" — `depth` preceded by a scroll-scrubbed envelope.
	// The envelope is the entire delta between the two layouts; everything
	// after it is the identical ScrollBody shell.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	// `opened` is false on the server too, so gate the lock on hydration —
	// otherwise a no-JS guest gets `.locked` in the SSR HTML forever, with no
	// tap ever able to clear it.
	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

<div class="overture" class:locked={mounted && !opened}>
	<Envelope
		monogram={ctx.monogram}
		title={ctx.title}
		greeting={t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}
		openLabel={t(ctx.lang, 'cover.open')}
		photo={ctx.imageUrls[0] ?? null}
		{opened}
		{onopen}
	/>

	<ScrollBody {data} {ctx} {currentRsvp} {errorKey} {preview} />
</div>

<style>
	.overture {
		position: relative;
	}

	/* Envelope.svelte's own `.stage.sealed` only caps the envelope's box, not
	   the ScrollBody sibling that follows it — without this, a guest can
	   scroll straight past the sealed envelope into the RSVP content and
	   never trigger `onopen` (the audio-unlock gesture). Same convention as
	   `depth`: lock the wrapper that contains both the gate and the body. */
	.overture.locked {
		height: 100svh;
		overflow: hidden;
	}
</style>
