<script lang="ts">
	import { enhance } from '$app/forms';
	import { SECTION_IDS } from '$lib/themes/schema';

	let { data, form } = $props();

	const theme = $derived(data.theme);
	let previewNonce = $state(0);

	const SECTION_LABELS: Record<string, string> = {
		hero: 'Names & welcome',
		countdown: 'Countdown',
		locations: 'Locations',
		schedule: 'Extra dates',
		rsvp: 'RSVP',
		closing: 'Closing'
	};
</script>

<svelte:head><title>Theme — EInvite Studio</title></svelte:head>

<div class="cols">
	<div class="st-card">
		<h2 class="st-h1">Theme</h2>
		{#if form?.error}<p class="st-error">{form.error}</p>{/if}
		{#if form?.saved}<p class="st-success">Saved — preview refreshed.</p>{/if}

		<form
			method="POST"
			action="?/save"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					previewNonce++;
				}}
		>
			<div class="preset-row">
				<span class="st-sub" style="margin:0">Start from a preset:</span>
				{#each data.presetNames as name (name)}
					<button class="st-btn secondary" name="applyPreset" value={name}>{name}</button>
				{/each}
				<input type="hidden" name="currentTheme" value={JSON.stringify(theme)} />
			</div>

			<input type="hidden" name="preset" value={theme.preset} />
			<input type="hidden" name="musicKey" value={theme.musicKey ?? ''} />

			<div class="grid4">
				<label class="st-field"
					>Background<input type="color" name="bg" value={theme.colors.bg} /></label
				>
				<label class="st-field"
					>Text<input type="color" name="text" value={theme.colors.text} /></label
				>
				<label class="st-field"
					>Accent<input type="color" name="accent" value={theme.colors.accent} /></label
				>
				<label class="st-field"
					>Muted<input type="color" name="muted" value={theme.colors.muted} /></label
				>
			</div>

			<label class="st-field"
				>Display font stack<input name="fontDisplay" value={theme.fonts.display} /></label
			>
			<label class="st-field"
				>Body font stack<input name="fontBody" value={theme.fonts.body} /></label
			>
			<label class="st-field"
				>Monogram (shown in the seal, e.g. E·M)<input
					name="monogram"
					value={theme.monogram ?? ''}
					maxlength="6"
				/></label
			>

			<fieldset class="slides">
				<legend>Slides &amp; order</legend>
				{#each SECTION_IDS as section (section)}
					{@const enabled = theme.slideOrder.includes(section)}
					{@const order = theme.slideOrder.indexOf(section)}
					<div class="slide-row">
						<label>
							<input type="checkbox" name="slide-{section}" checked={enabled} />
							{SECTION_LABELS[section]}
						</label>
						<input
							type="number"
							name="order-{section}"
							min="1"
							max="6"
							value={enabled ? order + 1 : SECTION_IDS.indexOf(section) + 1}
							aria-label="Order of {SECTION_LABELS[section]}"
						/>
					</div>
				{/each}
			</fieldset>

			{#each [['welcome', 'Welcome line (hero slide)'], ['closing', 'Closing message']] as [kind, label] (kind)}
				{@const current = (theme.texts as Record<string, Record<string, string>>)[kind]}
				<label class="st-field"
					>{label}
					<textarea name={kind} rows="2">{current?.en ?? current?.fr ?? current?.ar ?? ''}</textarea
					>
				</label>
			{/each}

			<button class="st-btn" style="margin-top:1rem">Save theme</button>
		</form>
	</div>

	<div class="st-card preview-card">
		<h2 class="st-h1">Live preview</h2>
		<p class="st-sub">Exactly what a guest sees (with a sample name).</p>
		{#key previewNonce}
			<iframe src="/e/{data.event.slug}/preview" title="Invitation preview"></iframe>
		{/key}
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: 1fr;
	}

	@media (min-width: 64rem) {
		.cols {
			grid-template-columns: 1.1fr 1fr;
			align-items: start;
		}
	}

	.preset-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 1.1rem;
	}

	.grid4 {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0 0.8rem;
	}

	.grid4 input[type='color'] {
		width: 100%;
		height: 2.4rem;
		padding: 0.15rem;
		border: 1px solid var(--st-border);
		border-radius: 8px;
		background: #fff;
	}

	.slides {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.8rem 1rem;
		margin: 0 0 1rem;
	}

	.slides legend {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--st-muted);
		padding-inline: 0.3rem;
	}

	.slide-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.25rem 0;
		font-size: 0.92rem;
	}

	.slide-row input[type='number'] {
		width: 4rem;
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--st-border);
		border-radius: 6px;
	}

	.preview-card iframe {
		width: 100%;
		aspect-ratio: 9 / 17;
		max-height: 44rem;
		border: 1px solid var(--st-border);
		border-radius: 18px;
	}
</style>
