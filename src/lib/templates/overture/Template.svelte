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

<div class="overture">
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
</style>
