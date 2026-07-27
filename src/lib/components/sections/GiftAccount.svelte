<script lang="ts">
	import { t, type Lang } from '$lib/i18n';

	// The cash-registry block (Whish/OMT/IBAN): engraved label between
	// hairlines, the number in stationery caps, one quiet copy button —
	// the gesture guests actually need when sending a gift from their phone.
	let { label, account, lang }: { label: string | null; account: string; lang: Lang } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(account);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard unavailable — the number stays visible and selectable
		}
	}
</script>

<div class="acct">
	{#if label}
		<p class="acct-label">
			<span class="hairline"></span><span class="text">{label}</span><span class="hairline"></span>
		</p>
	{/if}
	<p class="acct-number" dir="ltr">{account}</p>
	<button class="copy" type="button" class:copied onclick={copy}>
		<span aria-live="polite">{copied ? `✓ ${t(lang, 'gifts.copied')}` : t(lang, 'gifts.copy')}</span
		>
	</button>
</div>

<style>
	.acct {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.7rem;
		width: min(19rem, 100%);
		margin-top: 0.6rem;
	}

	.acct-label {
		margin: 0;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.hairline {
		flex: 1;
		height: 1px;
		background: color-mix(in srgb, currentColor 30%, transparent);
	}

	.acct-label .text {
		font-family: var(--ei-font-caps);
		font-size: 0.72rem;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	.acct-number {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 1.45rem;
		letter-spacing: 0.12em;
		font-variant-numeric: tabular-nums;
	}

	.copy {
		font-family: var(--ei-font-body);
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-indent: 0.22em;
		text-transform: uppercase;
		color: inherit;
		background: transparent;
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		padding: 0.55rem 1.3rem;
		cursor: pointer;
		transition:
			background-color 0.3s ease,
			border-color 0.3s ease;
	}

	.copy:hover {
		background: color-mix(in srgb, currentColor 10%, transparent);
	}

	.copy.copied {
		border-color: var(--ei-accent);
		color: var(--ei-accent);
	}

	.copy:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .acct-label .text,
	:global([dir='rtl']) .copy {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
