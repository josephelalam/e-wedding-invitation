<script lang="ts">
	import RsvpForm from '$lib/components/sections/RsvpForm.svelte';
	import { t } from '$lib/i18n';
	import type { InviteData, TemplateCtx } from '$lib/templates/types';
	import type { RsvpView } from '$lib/types';

	// Shared across all templates: the same battle-tested progressive form,
	// plus the owner-set deadline gate.
	let {
		data,
		ctx,
		currentRsvp,
		errorKey,
		preview
	}: {
		data: InviteData;
		ctx: TemplateCtx;
		currentRsvp: RsvpView;
		errorKey: string | null;
		preview: boolean;
	} = $props();
</script>

{#if ctx.rsvpIsClosed && !currentRsvp}
	<div class="closed">
		<h2 class="heading">{t(ctx.lang, 'rsvp.title')}</h2>
		<p>{t(ctx.lang, 'rsvp.closed')}</p>
	</div>
{:else if preview}
	<div class="preview-rsvp">
		<RsvpForm
			maxSeats={data.invitation.maxSeats}
			lang={ctx.lang}
			turnstileSiteKey={null}
			current={null}
			errorKey={null}
		/>
	</div>
{:else}
	<RsvpForm
		maxSeats={data.invitation.maxSeats}
		lang={ctx.lang}
		turnstileSiteKey={data.turnstileSiteKey}
		current={currentRsvp}
		{errorKey}
	/>
{/if}

<style>
	.closed {
		text-align: center;
		max-width: 26rem;
	}

	.closed .heading {
		margin: 0 0 0.8rem;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	.closed p {
		font-family: var(--ei-font-display);
		font-size: 1.25rem;
	}

	:global([dir='rtl']) .closed .heading {
		letter-spacing: 0;
	}

	.preview-rsvp {
		pointer-events: none;
		opacity: 0.85;
	}
</style>
