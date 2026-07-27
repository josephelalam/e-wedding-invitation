<script lang="ts">
	import { inview } from '$lib/actions/inview';

	let { text, monogram }: { text: string; monogram: string } = $props();
</script>

<div class="content" use:inview>
	<p class="mark" aria-hidden="true"><span>{monogram}</span></p>
	<p class="text">{text}</p>
	<p class="colophon">einvite</p>
</div>

<style>
	.content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.6rem;
		max-width: 30rem;
	}

	.mark {
		margin: 0;
		width: 4rem;
		height: 4rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 70%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		color: var(--ei-accent);
	}

	.mark span {
		display: grid;
		place-items: center;
		width: 3.3rem;
		height: 3.3rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 35%, transparent);
		border-radius: 999px;
	}

	.text {
		margin: 0;
		font-family: var(--ei-font-script);
		font-size: clamp(1.7rem, 6vw, 2.2rem);
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
