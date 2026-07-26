<script lang="ts">
	import { enhance } from '$app/forms';
	import { inview } from '$lib/actions/inview';
	import { t, type Lang } from '$lib/i18n';
	import type { RsvpView } from '$lib/types';

	let {
		maxSeats,
		lang,
		turnstileSiteKey,
		current,
		errorKey
	}: {
		maxSeats: number;
		lang: Lang;
		turnstileSiteKey: string | null;
		current: RsvpView;
		errorKey: string | null;
	} = $props();

	// The reply card is a plain HTML form: it must submit even where JS fails
	// (spec §4.6 — "worth real money in this market").
	let editing = $state(false);
	let attending = $state<'yes' | 'no'>('yes');
	let seats = $state(1);
	let busy = $state(false);

	const showForm = $derived(!current || editing);

	$effect(() => {
		if (current) {
			attending = current.attending ? 'yes' : 'no';
			seats = Math.min(Math.max(current.confirmedSeats, 1), maxSeats);
		}
	});

	const answeredOn = $derived(
		current
			? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
					day: 'numeric',
					month: 'long'
				}).format(new Date(current.updatedAt))
			: ''
	);

	function step(delta: number) {
		seats = Math.min(maxSeats, Math.max(1, seats + delta));
	}
</script>

<div class="content" use:inview>
	<h2 class="heading">{t(lang, 'rsvp.title')}</h2>

	{#if !showForm && current}
		<div class="summary">
			<p class="verdict">
				{current.attending ? t(lang, 'rsvp.success_yes') : t(lang, 'rsvp.success_no')}
			</p>
			{#if current.attending}
				<p class="seats-line">
					{t(lang, 'rsvp.seats_label')}: <strong>{current.confirmedSeats}</strong>
				</p>
			{/if}
			<p class="answered">{t(lang, 'rsvp.answered_on', { date: answeredOn })}</p>
			<button class="change" type="button" onclick={() => (editing = true)}>
				{t(lang, 'rsvp.change_hint')}
			</button>
		</div>
	{:else}
		<p class="question">{t(lang, 'rsvp.question')}</p>

		{#if errorKey}<p class="error" role="alert">{t(lang, errorKey)}</p>{/if}

		<form
			method="POST"
			action="?/rsvp"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					editing = false;
					await update({ reset: false });
				};
			}}
		>
			<div class="choices" role="radiogroup" aria-label={t(lang, 'rsvp.question')}>
				<label class="choice" class:selected={attending === 'yes'}>
					<input type="radio" name="attending" value="yes" bind:group={attending} required />
					<span>{t(lang, 'rsvp.yes')}</span>
				</label>
				<label class="choice" class:selected={attending === 'no'}>
					<input type="radio" name="attending" value="no" bind:group={attending} />
					<span>{t(lang, 'rsvp.no')}</span>
				</label>
			</div>

			{#if attending === 'yes'}
				<div class="seats">
					<span class="label" id="seats-label">{t(lang, 'rsvp.seats_label')}</span>
					<div class="stepper">
						<button type="button" onclick={() => step(-1)} aria-label="−" disabled={seats <= 1}>
							−
						</button>
						<input
							type="number"
							name="seats"
							min="1"
							max={maxSeats}
							bind:value={seats}
							aria-labelledby="seats-label"
							required
						/>
						<button
							type="button"
							onclick={() => step(1)}
							aria-label="+"
							disabled={seats >= maxSeats}
						>
							+
						</button>
					</div>
					<span class="of">{t(lang, 'rsvp.seats_of', { max: maxSeats })}</span>
				</div>
			{/if}

			<label class="note">
				<span class="label">{t(lang, 'rsvp.note_label')}</span>
				<textarea
					name="note"
					rows="2"
					maxlength="500"
					placeholder={t(lang, 'rsvp.note_placeholder')}
					value={current?.note ?? ''}></textarea>
			</label>

			{#if turnstileSiteKey}
				<div
					class="cf-turnstile"
					data-sitekey={turnstileSiteKey}
					data-theme="auto"
					data-language={lang}
					data-size="flexible"
				></div>
			{/if}

			<button class="submit" disabled={busy}>
				{busy ? t(lang, 'rsvp.submitting') : t(lang, 'rsvp.submit')}
			</button>
		</form>

		<p class="privacy">{t(lang, 'rsvp.privacy')}</p>
	{/if}
</div>

<style>
	.content {
		width: min(26rem, 100%);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.heading {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	.question {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.5rem;
	}

	.error {
		margin: 0;
		padding: 0.6rem 0.9rem;
		border-radius: 8px;
		font-size: 0.88rem;
		color: #8d3b34;
		background: color-mix(in srgb, #c0564d 12%, var(--ei-bg));
		border: 1px solid color-mix(in srgb, #c0564d 35%, transparent);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}

	.choice {
		border: 1px solid color-mix(in srgb, var(--ei-accent) 35%, transparent);
		border-radius: 10px;
		padding: 0.9rem 0.6rem;
		cursor: pointer;
		font-size: 0.95rem;
	}

	.choice input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.choice.selected,
	.choice:has(input:checked) {
		background: color-mix(in srgb, var(--ei-accent) 14%, var(--ei-bg));
		border-color: var(--ei-accent);
		font-weight: 600;
	}

	.choice:has(input:focus-visible) {
		outline: 2px solid var(--ei-accent);
		outline-offset: 2px;
	}

	.label {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		color: var(--ei-muted);
	}

	.seats {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.stepper button {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 45%, transparent);
		background: transparent;
		color: var(--ei-accent);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
	}

	.stepper button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.stepper input {
		width: 3.4rem;
		text-align: center;
		font-family: var(--ei-font-display);
		font-size: 1.6rem;
		border: none;
		background: transparent;
		color: var(--ei-text);
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.stepper input::-webkit-outer-spin-button,
	.stepper input::-webkit-inner-spin-button {
		-webkit-appearance: none;
	}

	.of {
		font-size: 0.8rem;
		color: var(--ei-muted);
	}

	.note {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		text-align: start;
	}

	.note textarea {
		font: inherit;
		font-size: 0.95rem;
		padding: 0.6rem 0.8rem;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 30%, transparent);
		background: color-mix(in srgb, var(--ei-bg) 60%, transparent);
		color: var(--ei-text);
		resize: vertical;
	}

	.note textarea:focus-visible {
		outline: 2px solid var(--ei-accent);
		outline-offset: 1px;
	}

	.cf-turnstile {
		align-self: center;
	}

	.submit {
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--ei-bg);
		background: var(--ei-accent);
		border: none;
		border-radius: 999px;
		padding: 0.95rem 2rem;
		cursor: pointer;
	}

	.submit:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.submit:focus-visible {
		outline: 2px solid var(--ei-text);
		outline-offset: 3px;
	}

	.privacy {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.6;
		color: color-mix(in srgb, var(--ei-muted) 80%, transparent);
	}

	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		align-items: center;
	}

	.verdict {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.35rem;
		text-wrap: balance;
	}

	.seats-line {
		margin: 0;
		font-size: 1rem;
	}

	.answered {
		margin: 0;
		font-size: 0.82rem;
		color: var(--ei-muted);
	}

	.change {
		margin-top: 0.4rem;
		background: none;
		border: none;
		font: inherit;
		font-size: 0.85rem;
		color: var(--ei-accent);
		text-decoration: underline;
		cursor: pointer;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .heading {
		letter-spacing: 0;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .label {
		letter-spacing: 0;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .submit {
		letter-spacing: 0;
	}
</style>
