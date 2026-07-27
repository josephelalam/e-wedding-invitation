<script lang="ts">
	// Ken Burns photo wall: two stacked layers crossfade through the set while
	// slowly breathing (scale 1 → 1.08). The market signature — photography is
	// the palette; everything else floats above on a scrim. Static first frame
	// for prefers-reduced-motion; next image is preloaded before each swap so
	// the fade never reveals an unloaded layer. An owner-placed background
	// video replaces the photo cycle (muted loop, first photo as poster);
	// reduced-motion guests keep the still photo.
	let {
		images,
		videoUrl = null,
		interval = 6500,
		scrim = 0.45
	}: { images: string[]; videoUrl?: string | null; interval?: number; scrim?: number } = $props();

	let index = $state(0);
	let previous = $state<number | null>(null);

	// SSR paints the video shell with its photo poster (no-JS guests keep the
	// still); reduced-motion clients drop to the photo wall on hydration.
	const videoActive = $derived(
		Boolean(videoUrl) &&
			(typeof window === 'undefined' ||
				!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
	);

	$effect(() => {
		if (videoActive) return;
		if (images.length < 2) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let alive = true;
		let timer: ReturnType<typeof setTimeout>;
		const advance = () => {
			const next = (index + 1) % images.length;
			const img = new Image();
			const swap = () => {
				if (!alive) return;
				previous = index;
				index = next;
				timer = setTimeout(advance, interval);
			};
			img.onload = swap;
			img.onerror = swap;
			img.src = images[next];
		};
		timer = setTimeout(advance, interval);
		return () => {
			alive = false;
			clearTimeout(timer);
		};
	});
</script>

<div class="wall" aria-hidden="true">
	{#if videoActive && videoUrl}
		<video class="video" src={videoUrl} poster={images[0]} autoplay muted loop playsinline></video>
	{:else}
		{#each images as url, i (url)}
			<div
				class="layer"
				class:current={i === index}
				class:leaving={i === previous}
				style="background-image:url('{url}')"
			></div>
		{/each}
	{/if}
	<div class="scrim" style="--scrim:{scrim}"></div>
</div>

<style>
	.wall {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #14100c;
	}

	.video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 1;
	}

	.layer {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		opacity: 0;
		z-index: 0;
	}

	.layer.current {
		opacity: 1;
		z-index: 1;
		transition: opacity 1.8s ease;
		animation: breathe 14s ease-in-out infinite alternate;
	}

	.layer.leaving {
		opacity: 0;
		z-index: 0;
		transition: opacity 1.8s ease;
		animation: breathe 14s ease-in-out infinite alternate;
	}

	@keyframes breathe {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.08);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layer.current,
		.layer.leaving {
			animation: none;
			transition: none;
		}
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 2;
		background: linear-gradient(
			to bottom,
			rgba(12, 9, 6, calc(var(--scrim) + 0.1)),
			rgba(12, 9, 6, calc(var(--scrim) - 0.12)) 45%,
			rgba(12, 9, 6, calc(var(--scrim) + 0.18))
		);
	}
</style>
