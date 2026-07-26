<script lang="ts">
	import { inview } from '$lib/actions/inview';

	let { text, monogram }: { text: string; monogram: string } = $props();
</script>

<div class="content" use:inview>
	<p class="mark" aria-hidden="true">{monogram}</p>
	<p class="text">{text}</p>
	<p class="colophon">einvite</p>
</div>

<style>
	.content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4rem;
		max-width: 30rem;
	}

	.mark {
		margin: 0;
		width: 3.1rem;
		height: 3.1rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 60%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		color: var(--ei-accent);
	}

	.text {
		margin: 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.45rem;
		line-height: 1.5;
		text-wrap: balance;
	}

	.colophon {
		margin: 2.2rem 0 0;
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ei-muted) 65%, transparent);
	}
</style>
