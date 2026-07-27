<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { SECTION_IDS } from '$lib/themes/schema';

	let { data, form } = $props();

	const theme = $derived(data.theme);
	let previewNonce = $state(0);
	// bind:group-controlled — a plain checked= would be reverted by re-renders.
	// Intentional local read: form state is seeded once from load data.
	// svelte-ignore state_referenced_locally
	let selectedTemplate = $state(data.theme.template as string);
	const activeTemplate = $derived(selectedTemplate);
	// The deck layouts live over photography: only the accent color applies.
	const isDeck = $derived(activeTemplate === 'slides' || activeTemplate === 'cinematic');

	// One panel at a time instead of one endless scroll; every panel stays in
	// the same <form> (hidden with CSS, not removed) so a single Save submits all.
	type Tab = 'layout' | 'look' | 'texts' | 'extras' | 'media';
	let tab = $state<Tab>('layout');
	const TABS: [Tab, string][] = [
		['layout', 'Layout'],
		['look', 'Look'],
		['texts', 'Texts'],
		['extras', 'Gifts & RSVP'],
		['media', 'Photos & Video']
	];

	// What this layout does with the media — shown above the manager.
	const MEDIA_GUIDE: Record<string, string> = {
		slides:
			'Signature Deck: the photos crossfade as one breathing wall behind every slide (the first is the cover). A background video replaces the photo wall.',
		edges:
			'Torn-Paper Story: the first photo is the hero, the middle ones become the torn photo bands, and the last one sits in the closing polaroid.',
		cinematic:
			'Horizon: the photos rotate behind the scenes (the first is the cover and poster; the last sits in the closing polaroid). A background video replaces the rotation.'
	};

	// Trilingual texts: one language visible at a time, all three submitted.
	const LANGS: [string, string][] = [
		['en', 'English'],
		['ar', 'عربي'],
		['fr', 'Français']
	];
	let textLang = $state('en');

	const SECTION_LABELS: Record<string, string> = {
		hero: 'Names & welcome',
		countdown: 'Countdown',
		locations: 'Locations',
		schedule: 'Extra dates',
		gifts: 'Gift registry (shows when the gifts note or account is filled)',
		rsvp: 'RSVP',
		closing: 'Closing'
	};

	const TEXT_GROUPS: [string, string, string][] = [
		['welcome', 'Welcome line', 'Shown under the names'],
		['intro', 'Opening verse / quote', 'The formal opening before the names'],
		[
			'parents',
			'Parents / families line',
			'e.g. "Mr. & Mrs. Karam · Mr. & Mrs. Aoun" (line breaks kept)'
		],
		['gifts', 'Gifts note', 'Shown on the gifts page above the account number'],
		['closing', 'Closing message', 'The goodbye at the end'],
		['endCaption', 'Ending caption', 'Under the last photo / polaroid']
	];

	let texts = $state(
		Object.fromEntries(
			TEXT_GROUPS.map(([kind]) => [
				kind,
				Object.fromEntries(
					LANGS.map(([code]) => [
						code,
						(data.theme.texts as Record<string, Record<string, string>>)[kind]?.[code] ?? ''
					])
				)
			])
		)
	);

	const filled = (kind: string, code: string) => (texts[kind]?.[code] ?? '').trim().length > 0;

	// Media forms save instantly: refresh the loaded theme + the live preview.
	let uploading = $state(false);
	const refreshAfter: SubmitFunction =
		() =>
		async ({ update }) => {
			await update();
			previewNonce++;
		};
	const uploadingAfter: SubmitFunction = () => {
		uploading = true;
		return async ({ update }) => {
			uploading = false;
			await update();
			previewNonce++;
		};
	};
</script>

<svelte:head><title>Theme — EInvite Studio</title></svelte:head>

<div class="cols">
	<div class="st-card editor">
		<form
			method="POST"
			action="?/save"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					previewNonce++;
				}}
		>
			<div class="ed-head">
				<h2 class="st-h1">Theme</h2>
				<nav class="ed-tabs" aria-label="Theme sections">
					{#each TABS as [id, label] (id)}
						<button
							type="button"
							class="ed-tab"
							class:active={tab === id}
							onclick={() => (tab = id)}
							aria-current={tab === id}
						>
							{label}
						</button>
					{/each}
				</nav>
			</div>

			<!-- ══ Layout ══════════════════════════════════════ -->
			<section class="panel" class:shown={tab === 'layout'}>
				<fieldset class="tpl-picker">
					<legend>Layout template — switching updates the preview instantly</legend>
					{#each data.templates as tpl (tpl.id)}
						<label class="tpl" class:active={activeTemplate === tpl.id}>
							<input type="radio" name="template" value={tpl.id} bind:group={selectedTemplate} />
							<span class="tpl-name">{tpl.name}</span>
							<span class="tpl-tag">{tpl.tagline}</span>
						</label>
					{/each}
				</fieldset>

				<p class="hint">
					Photos and the background video live in the <strong>Photos &amp; Video</strong> tab — each layout
					uses them differently.
				</p>

				{#if activeTemplate === 'slides'}
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
							value={(enabled ? theme.slideOrder.indexOf(section) : SECTION_IDS.indexOf(section)) +
								1}
						/>
					{/each}
				{/if}
			</section>

			<!-- ══ Look ════════════════════════════════════════ -->
			<section class="panel" class:shown={tab === 'look'}>
				{#if isDeck}
					<p class="hint" style="margin-top:0">
						This layout lives over your photography — the photos are the palette. Only the
						<strong>accent</strong> (seal, dots, buttons) applies.
					</p>
					<div class="grid4">
						<label class="st-field"
							>Accent<input type="color" name="accent" value={theme.colors.accent} /></label
						>
					</div>
					<input type="hidden" name="bg" value={theme.colors.bg} />
					<input type="hidden" name="text" value={theme.colors.text} />
					<input type="hidden" name="muted" value={theme.colors.muted} />
				{:else}
					<div class="preset-row">
						<span class="st-sub" style="margin:0">Colors from a preset:</span>
						{#each data.presetNames as name (name)}
							<button class="st-btn secondary" name="applyPreset" value={name}>{name}</button>
						{/each}
					</div>
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
				{/if}
				<input type="hidden" name="currentTheme" value={JSON.stringify(theme)} />

				<label class="st-field"
					>Monogram (the seal, e.g. E·M)<input
						name="monogram"
						value={theme.monogram ?? ''}
						maxlength="6"
					/></label
				>
				<label class="st-field"
					>Ambient effect (floating over every layout)
					<select name="effect" value={theme.effect}>
						<option value="none">None</option>
						<option value="petals">Falling petals</option>
						<option value="hearts">Falling hearts</option>
						<option value="sparkles">Rising gold dust</option>
						<option value="leaves">Falling leaves</option>
						<option value="snow">Snowfall</option>
					</select>
				</label>
				<details class="fonts">
					<summary>Advanced: font stacks</summary>
					<label class="st-field"
						>Display font stack<input name="fontDisplay" value={theme.fonts.display} /></label
					>
					<label class="st-field"
						>Body font stack<input name="fontBody" value={theme.fonts.body} /></label
					>
				</details>
			</section>

			<!-- ══ Texts ═══════════════════════════════════════ -->
			<section class="panel" class:shown={tab === 'texts'}>
				<div class="lang-tabs" role="tablist" aria-label="Text language">
					{#each LANGS as [code, label] (code)}
						<button
							type="button"
							class="lang-tab"
							class:active={textLang === code}
							onclick={() => (textLang = code)}
						>
							{label}
						</button>
					{/each}
				</div>
				{#each TEXT_GROUPS as [kind, label, hint] (kind)}
					<div class="tgroup">
						<div class="tg-head">
							<span class="tg-label">{label}</span>
							<span class="tg-dots" title="Filled languages">
								{#each LANGS as [code] (code)}
									<span class="dot" class:full={filled(kind, code)}>{code}</span>
								{/each}
							</span>
						</div>
						<p class="hint tg-hint">{hint}</p>
						{#each LANGS as [code] (code)}
							<textarea
								name="{kind}-{code}"
								rows="2"
								dir={code === 'ar' ? 'rtl' : 'ltr'}
								class:hiddenLang={textLang !== code}
								bind:value={texts[kind][code]}></textarea>
						{/each}
					</div>
				{/each}
			</section>

			<!-- ══ Gifts & RSVP ════════════════════════════════ -->
			<section class="panel" class:shown={tab === 'extras'}>
				<fieldset class="boxed">
					<legend>Gift registry account</legend>
					<p class="hint" style="margin-top:0">
						Shown on the gifts page as an engraved line with a one-tap
						<strong>copy button</strong> — how guests actually send a gift from their phone. The note
						text above it lives in the Texts tab ("Gifts note").
					</p>
					<div class="two">
						<label class="st-field"
							>Service label<input
								name="giftsAccountLabel"
								value={theme.giftsAccountLabel ?? ''}
								placeholder="Whish Money"
							/></label
						>
						<label class="st-field"
							>Account number<input
								name="giftsAccount"
								value={theme.giftsAccount ?? ''}
								placeholder="03 123 456"
							/></label
						>
					</div>
				</fieldset>

				<label class="st-field"
					>RSVP deadline (optional — form closes after this day)
					<input name="rsvpDeadline" type="date" value={theme.rsvpDeadline ?? ''} />
				</label>
			</section>

			<input type="hidden" name="preset" value={theme.preset} />
			<input type="hidden" name="musicKey" value={theme.musicKey ?? ''} />

			{#if tab !== 'media'}
				<div class="ed-save">
					<span class="save-msg">
						{#if form?.error}<span class="st-error slim">{form.error}</span>{/if}
						{#if form?.saved}<span class="st-success slim">Saved — preview refreshed.</span>{/if}
					</span>
					<button class="st-btn">Save theme</button>
				</div>
			{/if}
		</form>

		<!-- ══ Photos & Video (own forms — uploads save instantly) ══ -->
		{#if tab === 'media'}
			<section class="media-panel">
				<p class="hint" style="margin-top:0">{MEDIA_GUIDE[activeTemplate]}</p>

				{#if form?.mediaError}<p class="st-error">{form.mediaError}</p>{/if}
				{#if form?.mediaSaved}<p class="st-success">{form.mediaSaved}</p>{/if}

				{#if theme.images.length === 0}
					<p class="st-empty">
						No photos yet — the invitation shows the built-in styled set until you add the couple's
						own.
					</p>
				{:else}
					<ul class="thumbs">
						{#each theme.images as key, index (key)}
							<li class="thumb">
								<img src="/api/media/{key}" alt="Photo {index + 1}" loading="lazy" />
								<span class="thumb-n">{index + 1}</span>
								<span class="thumb-tools">
									<form method="POST" action="?/moveImage" use:enhance={refreshAfter}>
										<input type="hidden" name="key" value={key} />
										<input type="hidden" name="dir" value="back" />
										<button title="Move earlier" aria-label="Move photo {index + 1} earlier"
											>‹</button
										>
									</form>
									<form method="POST" action="?/moveImage" use:enhance={refreshAfter}>
										<input type="hidden" name="key" value={key} />
										<input type="hidden" name="dir" value="forward" />
										<button title="Move later" aria-label="Move photo {index + 1} later">›</button>
									</form>
									<form method="POST" action="?/removeImage" use:enhance={refreshAfter}>
										<input type="hidden" name="key" value={key} />
										<button class="del" title="Remove" aria-label="Remove photo {index + 1}"
											>✕</button
										>
									</form>
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				<form
					method="POST"
					action="?/uploadPhotos"
					enctype="multipart/form-data"
					use:enhance={uploadingAfter}
				>
					<label class="st-field"
						>Add photos (JPG, PNG or WebP — up to 8 MB each, {12 - theme.images.length} slot{12 -
							theme.images.length ===
						1
							? ''
							: 's'} left)
						<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple />
					</label>
					<button class="st-btn" disabled={uploading}>
						{uploading ? 'Uploading…' : 'Upload photos'}
					</button>
				</form>

				{#if isDeck}
					<div class="video-block">
						<h3 class="media-h">Background video</h3>
						<p class="hint">
							Plays as a muted loop behind every scene; the photos stay the poster and the
							reduced-motion fallback. Best results: <strong>vertical 9:16 MP4 (H.264)</strong>,
							1080×1920, 24–30 fps, a 20–60 s seamless loop, <strong>under 30 MB</strong>, audio
							track removed (the invitation music plays separately).
						</p>
						{#if theme.videoKey}
							<div class="video-now">
								<!-- svelte-ignore a11y_media_has_caption -- decorative background loop -->
								<video src="/api/media/{theme.videoKey}" muted loop autoplay playsinline></video>
								<form method="POST" action="?/removeVideo" use:enhance={refreshAfter}>
									<button class="st-btn danger">Remove video</button>
								</form>
							</div>
						{/if}
						<form
							method="POST"
							action="?/uploadVideo"
							enctype="multipart/form-data"
							use:enhance={uploadingAfter}
						>
							<label class="st-field"
								>{theme.videoKey ? 'Replace video' : 'Add video'} (MP4 or WebM, up to 30 MB)
								<input type="file" name="video" accept="video/mp4,video/webm" />
							</label>
							<button class="st-btn" disabled={uploading}>
								{uploading ? 'Uploading…' : 'Upload video'}
							</button>
						</form>
					</div>
				{/if}
			</section>
		{/if}
	</div>

	<div class="st-card preview-card">
		<h2 class="st-h1">Live preview</h2>
		<p class="st-sub">
			Exactly what a guest sees (with a sample name). Unsaved layout switches show instantly.
		</p>
		{#key previewNonce}
			<iframe
				src="/e/{data.event.slug}/preview?template={activeTemplate}"
				title="Invitation preview"
			></iframe>
		{/key}
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: 1fr;
		align-items: start;
	}

	@media (min-width: 64rem) {
		.cols {
			grid-template-columns: 1.1fr 1fr;
		}

		.preview-card {
			position: sticky;
			top: 1rem;
		}
	}

	/* ── editor chrome ─────────────────────────────────── */
	.editor {
		display: flex;
		flex-direction: column;
	}

	.ed-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.1rem;
	}

	.ed-head .st-h1 {
		margin: 0;
	}

	.ed-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--st-bg);
		border: 1px solid var(--st-border);
		border-radius: 10px;
		padding: 0.25rem;
		flex-wrap: wrap;
	}

	.ed-tab {
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--st-muted);
		padding: 0.45rem 0.85rem;
		border-radius: 7px;
		cursor: pointer;
	}

	.ed-tab.active {
		background: #fff;
		color: var(--st-accent-dark);
		box-shadow: 0 1px 3px rgba(40, 30, 20, 0.12);
	}

	.panel {
		display: none;
	}

	.panel.shown {
		display: block;
	}

	.ed-save {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--st-border);
		position: sticky;
		bottom: 0;
		background: #fff;
		padding-bottom: 0.25rem;
	}

	.save-msg .slim {
		margin: 0;
		padding: 0.35rem 0.7rem;
		font-size: 0.82rem;
	}

	/* ── layout panel ──────────────────────────────────── */
	.tpl-picker {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.8rem 1rem;
		margin: 0 0 1.1rem;
		display: grid;
		gap: 0.6rem;
	}

	.tpl-picker legend,
	.slides legend,
	.boxed legend {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--st-muted);
		padding-inline: 0.3rem;
	}

	.tpl {
		display: grid;
		grid-template-columns: auto 1fr;
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
		grid-column: 1 / 3;
		font-size: 0.8rem;
		color: var(--st-muted);
	}

	.slides,
	.boxed {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.8rem 1rem;
		margin: 0 0 1rem;
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

	/* ── look panel ────────────────────────────────────── */
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

	.fonts {
		margin-top: 0.4rem;
	}

	.fonts summary {
		font-size: 0.82rem;
		color: var(--st-muted);
		cursor: pointer;
		margin-bottom: 0.6rem;
	}

	/* ── texts panel ───────────────────────────────────── */
	.lang-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--st-bg);
		border: 1px solid var(--st-border);
		border-radius: 10px;
		padding: 0.25rem;
		width: max-content;
		margin-bottom: 1.1rem;
	}

	.lang-tab {
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--st-muted);
		padding: 0.4rem 1rem;
		border-radius: 7px;
		cursor: pointer;
	}

	.lang-tab.active {
		background: #fff;
		color: var(--st-accent-dark);
		box-shadow: 0 1px 3px rgba(40, 30, 20, 0.12);
	}

	.tgroup {
		padding: 0.75rem 0;
		border-top: 1px solid var(--st-border);
	}

	.tgroup:first-of-type {
		border-top: none;
	}

	.tg-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.tg-label {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.tg-dots {
		display: flex;
		gap: 0.3rem;
	}

	.dot {
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--st-muted);
		border: 1px solid var(--st-border);
		border-radius: 5px;
		padding: 0.1rem 0.35rem;
		opacity: 0.55;
	}

	.dot.full {
		opacity: 1;
		border-color: var(--st-accent);
		color: var(--st-accent-dark);
		background: color-mix(in srgb, var(--st-accent) 10%, transparent);
	}

	.tg-hint {
		margin: 0.15rem 0 0.5rem !important;
	}

	.tgroup textarea {
		width: 100%;
		font: inherit;
		font-size: 0.92rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--st-border);
		border-radius: 8px;
		resize: vertical;
	}

	.tgroup textarea.hiddenLang {
		display: none;
	}

	/* ── extras panel ──────────────────────────────────── */
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 0.8rem;
	}

	@media (max-width: 40rem) {
		.two {
			grid-template-columns: 1fr;
		}
	}

	.hint {
		font-size: 0.78rem;
		color: var(--st-muted);
		margin: -0.4rem 0 1rem;
		line-height: 1.6;
	}

	/* ── media panel ───────────────────────────────────── */
	.media-panel .hint {
		margin-top: 0;
	}

	.thumbs {
		list-style: none;
		margin: 0 0 1.2rem;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
		gap: 0.7rem;
	}

	.thumb {
		position: relative;
		border: 1px solid var(--st-border);
		border-radius: var(--st-radius-sm);
		overflow: hidden;
		background: var(--st-surface-2);
	}

	.thumb img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
	}

	.thumb-n {
		position: absolute;
		top: 0.4rem;
		inset-inline-start: 0.4rem;
		display: grid;
		place-items: center;
		min-width: 1.3rem;
		height: 1.3rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: rgba(34, 31, 27, 0.65);
		color: #fff;
		font-size: 0.72rem;
	}

	.thumb-tools {
		position: absolute;
		inset-block-end: 0.4rem;
		inset-inline: 0.4rem;
		display: flex;
		justify-content: center;
		gap: 0.35rem;
	}

	.thumb-tools form {
		display: contents;
	}

	.thumb-tools button {
		width: 1.7rem;
		height: 1.7rem;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		color: var(--st-text);
		font-size: 0.95rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(35, 30, 22, 0.25);
	}

	.thumb-tools button:hover {
		background: #fff;
	}

	.thumb-tools button.del {
		color: var(--st-danger);
	}

	.thumb-tools button:focus-visible {
		outline: 2px solid var(--st-gold);
		outline-offset: 1px;
	}

	.video-block {
		margin-top: 1.6rem;
		padding-top: 1.2rem;
		border-top: 1px solid var(--st-border);
	}

	.media-h {
		margin: 0 0 0.4rem;
		font-family: var(--st-font-display);
		font-size: 1.15rem;
		font-weight: 600;
	}

	.video-now {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.video-now video {
		width: 8.5rem;
		aspect-ratio: 9 / 16;
		object-fit: cover;
		border-radius: var(--st-radius-sm);
		border: 1px solid var(--st-border);
		background: #14100c;
	}

	.preview-card iframe {
		width: 100%;
		aspect-ratio: 9 / 17;
		max-height: 44rem;
		border: 1px solid var(--st-border);
		border-radius: 18px;
	}
</style>
