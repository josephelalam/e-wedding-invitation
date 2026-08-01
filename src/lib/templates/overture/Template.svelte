<script lang="ts">
	import Envelope from '$lib/templates/shared/Envelope.svelte';
	import ScrollBody from '$lib/templates/shared/ScrollBody.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "overture" — `depth` preceded by a scroll-scrubbed envelope.
	// The envelope is the entire delta between the two layouts; everything
	// after it is the identical ScrollBody shell.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();
</script>

<!-- `opened` is false on the server too, so the lock must be present from the
     very first SSR byte — gating it on a post-hydration `mounted` flag left a
     window (first paint to JS-ready) where the body was scrollable, and the
     lock snapping on mid-scroll yanked the guest back to the cover. The only
     guest who needs an escape hatch is one with no JS to ever fire `onopen`,
     and `<noscript>` targets exactly that case with no timing window at all. -->
<div class="overture" class:locked={!opened}>
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

<noscript>
	<style>
		/* No-JS guests can never fire `onopen`, so the SSR-immediate lock above
		   would trap them behind the sealed envelope forever — this is their
		   only way in. `!important` is required: Svelte scopes `.overture.locked`
		   with its own hash class (e.g. `.overture.locked.svelte-abc123`), three
		   selectors deep, so a plain `.locked` rule here would lose the
		   specificity fight. */
		.overture.locked {
			height: auto !important;
			overflow: visible !important;
		}
	</style>
</noscript>

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
