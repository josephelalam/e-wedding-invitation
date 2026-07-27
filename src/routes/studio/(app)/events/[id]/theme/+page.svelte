<script lang="ts">
	import { enhance } from '$app/forms';
	import { SECTION_IDS } from '$lib/themes/schema';

	let { data, form } = $props();

	const theme = $derived(data.theme);
	let previewNonce = $state(0);
	// bind:group-controlled — a plain checked= would be reverted by re-renders.
	// Intentional local read: form state is seeded once from load data.
	// svelte-ignore state_referenced_locally
	let selectedTemplate = $state(data.theme.template as string);
	const activeTemplate = $derived(selectedTemplate);

	const SECTION_LABELS: Record<string, string> = {
		hero: 'Names & welcome',
		countdown: 'Countdown',
		locations: 'Locations',
		schedule: 'Extra dates',
		gifts: 'Gift registry (shows when the gifts note is filled)',
		rsvp: 'RSVP',
		closing: 'Closing'
	};

	const TEXT_GROUPS: [string, string, string][] = [
		['welcome', 'Welcome line', 'Shown under the names'],
		['closing', 'Closing message', 'The goodbye at the end'],
		['intro', 'Opening verse / quote', 'Story templates: shown before the names'],
		['parents', 'Parents line', 'e.g. "Mr. & Mrs. Karam · Mr. & Mrs. Aoun" (line breaks kept)'],
		['gifts', 'Gifts note', 'Shown in its own section when filled (wedding list, numbers…)'],
		['endCaption', 'Ending caption', 'Story templates: under the last photo']
	];
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
			<fieldset class="tpl-picker">
				<legend>Layout template</legend>
				{#each data.templates as tpl (tpl.id)}
					<label class="tpl" class:active={activeTemplate === tpl.id}>
						<input type="radio" name="template" value={tpl.id} bind:group={selectedTemplate} />
						<span class="tpl-name">{tpl.name}</span>
						<span class="tpl-tag">{tpl.tagline}</span>
						{#if tpl.usesImages}<span class="tpl-imgs">uses photos</span>{/if}
					</label>
				{/each}
			</fieldset>

			<div class="preset-row">
				<span class="st-sub" style="margin:0">Colors from a preset:</span>
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
			<label class="st-field"
				>RSVP deadline (optional — form closes after this day)
				<input name="rsvpDeadline" type="date" value={theme.rsvpDeadline ?? ''} />
			</label>

			<label class="st-field"
				>Photos (one R2 key per line — used by the photo templates)
				<textarea name="images" rows="3" placeholder={'theme/' + data.event.slug + '/1.jpg'}
					>{theme.images.join('\n')}</textarea
				>
			</label>
			<p class="hint">
				Photos are placed manually (your no-upload rule): <code class="st-code"
					>npx wrangler r2 object put einvite-media/theme/{data.event.slug}/1.jpg --file photo.jpg
					--remote</code
				>
			</p>

			{#if activeTemplate === 'slides'}
				<fieldset class="slides">
					<legend>Slides &amp; order (Envelope template)</legend>
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
								max={SECTION_IDS.length}
								value={enabled ? order + 1 : SECTION_IDS.indexOf(section) + 1}
								aria-label="Order of {SECTION_LABELS[section]}"
							/>
						</div>
					{/each}
				</fieldset>
			{:else}
				{#each SECTION_IDS as section (section)}
					{@const enabled = theme.slideOrder.includes(section)}
					<input type="hidden" name="slide-{section}" value={enabled ? 'on' : ''} />
					<input
						type="hidden"
						name="order-{section}"
						value={(enabled ? theme.slideOrder.indexOf(section) : SECTION_IDS.indexOf(section)) + 1}
					/>
				{/each}
			{/if}

			{#each TEXT_GROUPS as [kind, label, hint] (kind)}
				{@const current = (theme.texts as Record<string, Record<string, string>>)[kind]}
				<fieldset class="texts">
					<legend>{label}</legend>
					<p class="hint" style="margin-top:0">{hint}</p>
					{#each [['en', 'English'], ['ar', 'Arabic'], ['fr', 'French']] as [code, name] (code)}
						<label class="st-field"
							>{name}
							<textarea name="{kind}-{code}" rows="2" dir={code === 'ar' ? 'rtl' : 'ltr'}
								>{current?.[code] ?? ''}</textarea
							>
						</label>
					{/each}
				</fieldset>
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

	.tpl-picker {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.8rem 1rem;
		margin: 0 0 1.1rem;
		display: grid;
		gap: 0.6rem;
	}

	.tpl-picker legend {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--st-muted);
		padding-inline: 0.3rem;
	}

	.tpl {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.25rem 0.6rem;
		align-items: center;
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		cursor: pointer;
	}

	.tpl.active {
		border-color: var(--st-accent);
		background: color-mix(in srgb, var(--st-accent) 8%, transparent);
	}

	.tpl-name {
		font-weight: 600;
	}

	.tpl-tag {
		grid-column: 2 / 4;
		font-size: 0.8rem;
		color: var(--st-muted);
	}

	.tpl-imgs {
		font-size: 0.68rem;
		letter-spacing: 0.05em;
		background: #efeae2;
		color: var(--st-muted);
		border-radius: 5px;
		padding: 0.15rem 0.45rem;
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

	.slides,
	.texts {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.8rem 1rem;
		margin: 0 0 1rem;
	}

	.slides legend,
	.texts legend {
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

	.hint {
		font-size: 0.78rem;
		color: var(--st-muted);
		margin: -0.4rem 0 1rem;
		line-height: 1.6;
	}

	.preview-card iframe {
		width: 100%;
		aspect-ratio: 9 / 17;
		max-height: 44rem;
		border: 1px solid var(--st-border);
		border-radius: 18px;
	}
</style>
