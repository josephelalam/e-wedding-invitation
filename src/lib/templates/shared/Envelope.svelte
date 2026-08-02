<script module lang="ts">
	// WebGL2 support doesn't change mid-session, but probing it always
	// allocates a real GPU context. Module scope is shared across every
	// Envelope instance (i.e. every template switch), so this caps the
	// probe at one context for the whole tab instead of one per switch —
	// the difference matters on exactly the low-end devices where the
	// ~8-16 live-context budget bites and `WEBGL_lose_context` (used below
	// to free the probe context immediately) may not be available to force
	// the issue.
	let webgl2Supported: boolean | undefined;
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { progress } from '$lib/actions/scroll-progress';
	import type { EnvelopeScene } from '$lib/templates/shared/envelope-webgl';

	// The envelope overture: a sealed envelope whose flap opens and whose card
	// rises and fills the screen as the guest scrolls. CSS 3D is the DEFAULT
	// renderer and the permanent fallback; three.js is an upgrade that swaps in
	// only when it can, and disposes itself the moment the scrub completes.
	//
	// The tap is mandatory, not decorative: it is the audio-unlock gesture, and
	// iOS Safari will not start audio from a scroll.
	let {
		monogram,
		title,
		greeting,
		openLabel,
		photo = null,
		opened,
		onopen
	}: {
		monogram: string;
		title: string;
		greeting: string;
		openLabel: string;
		photo?: string | null;
		opened: boolean;
		onopen: () => void;
	} = $props();

	let stage: HTMLElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let webgl = $state(false);
	let scene: EnvelopeScene | undefined;

	// Bumped on unmount so an in-flight upgrade() (stuck awaiting the chunk
	// import or the texture fetch) can tell, once it resolves, that its own
	// attempt is stale — see upgrade() below.
	let generation = 0;
	onDestroy(() => {
		generation++;
	});

	function capable(): boolean {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
		const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
		if (connection?.saveData === true) return false;
		const memory = (navigator as { deviceMemory?: number }).deviceMemory;
		if (typeof memory === 'number' && memory < 4) return false;
		if (webgl2Supported === undefined) {
			const probe = document.createElement('canvas').getContext('webgl2');
			probe?.getExtension('WEBGL_lose_context')?.loseContext();
			webgl2Supported = !!probe;
		}
		return webgl2Supported;
	}

	function currentProgress(): number {
		const raw = stage?.style.getPropertyValue('--p');
		return raw ? Number(raw) : 0;
	}

	// Fired by the open gesture, so the download overlaps the flap animation
	// the CSS version is already running.
	async function upgrade() {
		if (webgl || scene || !capable()) return;
		// Captured before the first await: mountEnvelope() awaits the photo
		// texture over the network (the normal path — overture always passes
		// a photo), so this call can easily outlive the component (a template
		// switch in the owner's preview) or the scrub (a slow connection). Both
		// resolve against `generation`/`currentProgress()` below rather than
		// assuming the world hasn't moved on.
		const gen = generation;
		try {
			const module = await import('$lib/templates/shared/envelope-webgl');
			// A renderer swap mid-animation is worse than no upgrade at all.
			if (gen !== generation || currentProgress() > 0.15 || !canvas) return;
			const styles = getComputedStyle(stage as HTMLElement);
			const mounted = await module.mountEnvelope(canvas, {
				accent: styles.getPropertyValue('--ei-accent').trim() || '#b8966e',
				paper: styles.getPropertyValue('--ei-bg').trim() || '#faf7f1',
				photo
			});
			// Re-check both signals now that the texture fetch has resolved:
			// the component may have been destroyed, or the guest may have
			// scrolled well past the handoff budget, while it was in flight.
			// Adopting a stale scene here is exactly the leak/mid-animation-
			// swap this gate exists to prevent — dispose instead.
			if (gen !== generation || currentProgress() > 0.15 || !canvas) {
				mounted.dispose();
				return;
			}
			scene = mounted;
			webgl = true;
		} catch {
			// Guest HTML is edge-cached 120s, so after a deploy the chunk URL can
			// 404. A failed upgrade must be invisible: the CSS envelope stays.
		}
	}

	function handleOpen() {
		onopen();
		void upgrade();
	}

	// Feed the shared scroll progress to the scene, and free the GPU the
	// moment the overture is over. Mirrors scroll-progress.ts's wake()/tick()
	// parking strategy exactly (see the comment at the top of that file):
	// only reschedule the frame while progress is actually changing, and
	// resume on the same scroll/resize/visibilitychange signals it uses.
	// Without this a guest who taps open and then stops scrolling — or sets
	// the phone down with the music playing — holds a WebGL context
	// rendering an unchanged scene at 60fps for the rest of the visit.
	$effect(() => {
		if (!webgl || !scene || !stage) return;
		let raf = 0;
		let last = -1;
		const tick = () => {
			raf = 0;
			const p = currentProgress();
			const changed = p !== last;
			if (changed) {
				last = p;
				scene?.setProgress(p);
			}
			if (p >= 0.995) {
				scene?.dispose();
				scene = undefined;
				webgl = false;
				return;
			}
			// Only keep chasing frames while progress is still moving; once a
			// frame produces no change, park and wait for wake().
			if (changed && !document.hidden) raf = requestAnimationFrame(tick);
		};
		const wake = () => {
			if (raf || document.hidden) return;
			raf = requestAnimationFrame(tick);
		};
		wake();
		window.addEventListener('scroll', wake, { passive: true });
		window.addEventListener('resize', wake, { passive: true });
		document.addEventListener('visibilitychange', wake);
		return () => {
			window.removeEventListener('scroll', wake);
			window.removeEventListener('resize', wake);
			document.removeEventListener('visibilitychange', wake);
			if (raf) cancelAnimationFrame(raf);
			scene?.dispose();
			scene = undefined;
		};
	});
</script>

<!-- `id="slide-0"` lives here rather than on ScrollBody's first section: this
     stage is what the dispatcher's post-open smooth-scroll (InvitationPage's
     `open()`) must resolve to for `overture`, so the guest lands at the top of
     the still-scrubbable envelope instead of being carried straight through
     it. ScrollBody's `ownsSlideAnchor` prop is set to false by overture/Template.svelte
     for exactly this reason — see the comment there and in ScrollBody.svelte. -->
<div
	class="stage"
	class:sealed={!opened}
	class:webgl
	bind:this={stage}
	use:progress={'sticky'}
	id="slide-0"
>
	<div class="sticky">
		<canvas class="gl" class:on={webgl} bind:this={canvas} aria-hidden="true"></canvas>
		<div class="env" aria-label={title}>
			<div class="card">
				{#if photo}
					<div class="card-photo" style="background-image:url('{photo}')"></div>
				{/if}
				<p class="card-mark" aria-hidden="true">{monogram}</p>
				<h1 class="card-title">{title}</h1>
			</div>

			<div class="back"></div>
			<div class="side left"></div>
			<div class="side right"></div>
			<div class="bottom"></div>
			<div class="flap"></div>
		</div>

		{#if !opened}
			<div class="gate">
				<p class="greeting">{greeting}</p>
				<button class="open" type="button" onclick={handleOpen}>{openLabel}</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* 200vh of scroll drives the open; the envelope is sticky inside it. */
	.stage {
		height: 200svh;
		position: relative;
	}

	.sticky {
		position: sticky;
		top: 0;
		height: 100svh;
		display: grid;
		place-items: center;
		perspective: 1400px;
		overflow: hidden;
	}

	.gl {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		pointer-events: none;
	}

	.gl.on {
		opacity: 1;
	}

	/* When WebGL takes over, the CSS envelope steps aside — same scrub, same
	   geometry, so the handoff is invisible. */
	.stage.webgl .env {
		opacity: 0;
	}

	/* Before the gesture the guest cannot scroll past the envelope. */
	.stage.sealed {
		height: 100svh;
	}

	.env {
		position: relative;
		width: min(22rem, 82vw);
		aspect-ratio: 3 / 2;
		transform-style: preserve-3d;
	}

	.back,
	.side,
	.bottom,
	.flap {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--ei-bg) 92%, var(--ei-accent));
		border: 1px solid color-mix(in srgb, var(--ei-accent) 30%, transparent);
	}

	.back {
		transform: translateZ(-1px);
	}

	.side,
	.bottom {
		background: color-mix(in srgb, var(--ei-bg) 86%, var(--ei-accent));
	}

	.side.left {
		clip-path: polygon(0 0, 50% 50%, 0 100%);
	}

	.side.right {
		clip-path: polygon(100% 0, 100% 100%, 50% 50%);
	}

	.bottom {
		clip-path: polygon(0 100%, 50% 50%, 100% 100%);
		z-index: 3;
	}

	/* p 0 -> 0.35: flap rotates open about its top edge. */
	.flap {
		clip-path: polygon(0 0, 100% 0, 50% 50%);
		transform-origin: top center;
		transform: rotateX(calc(clamp(0, calc(var(--p, 1) * 2.857), 1) * -170deg));
		z-index: 4;
		backface-visibility: hidden;
	}

	/* p 0.35 -> 0.75: the card rises out. p 0.75 -> 1: it scales to fill. */
	.card {
		position: absolute;
		inset: 6% 5%;
		--rise: clamp(0, calc((var(--p, 1) - 0.35) * 2.5), 1);
		--fill: clamp(0, calc((var(--p, 1) - 0.75) * 4), 1);
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		overflow: hidden;
		background: var(--ei-bg);
		border: 1px solid color-mix(in srgb, var(--ei-accent) 34%, transparent);
		/* --dir carries the writing direction so the transform is written once. */
		--dir: 1;
		transform: translate(calc(var(--dir) * var(--fill) * 4%), calc(var(--rise) * -55%))
			rotateX(calc((1 - var(--rise)) * 8deg)) scale(calc(1 + var(--fill) * 1.35));
		will-change: transform;
	}

	/* RTL mirrors the card's slight lateral drift on exit. */
	:global([dir='rtl']) .card {
		--dir: -1;
	}

	.card-photo {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		opacity: 0.28;
	}

	.card-mark {
		position: relative;
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.3rem;
		color: var(--ei-accent);
	}

	.card-title {
		position: relative;
		margin: 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(1.6rem, 6vw, 2.2rem);
		text-align: center;
		text-wrap: balance;
	}

	.gate {
		position: absolute;
		inset-block-end: 12vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.greeting {
		margin: 0;
		font-family: var(--ei-font-display);
		color: var(--ei-muted);
	}

	.open {
		font-family: var(--ei-font-body);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.24em;
		text-indent: 0.24em;
		text-transform: uppercase;
		color: inherit;
		background: transparent;
		border: 1px solid color-mix(in srgb, currentColor 45%, transparent);
		padding: 0.8rem 1.8rem;
		cursor: pointer;
	}

	.open:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .open {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
