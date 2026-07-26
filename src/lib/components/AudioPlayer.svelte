<script lang="ts">
	// One persistent <audio> element, mounted OUTSIDE the scroll container and
	// never re-mounted, so playback survives every swipe (spec §3.1.4).
	let {
		src,
		muteLabel,
		unmuteLabel
	}: { src: string | null; muteLabel: string; unmuteLabel: string } = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let started = $state(false);
	let muted = $state(false);

	/** Called from inside the cover-button gesture — the browser's audio unlock. */
	export async function start(): Promise<boolean> {
		if (!audio || started) return started;
		try {
			audio.volume = 0;
			await audio.play();
			started = true;
			fadeIn();
			return true;
		} catch {
			// Autoplay refused or file missing: the invitation stays silent but
			// fully usable — music is an enhancement, never a gate (spec §3.1.4).
			return false;
		}
	}

	function fadeIn() {
		if (!audio) return;
		const durationMs = 1400;
		const startedAt = performance.now();
		const tick = (now: number) => {
			if (!audio) return;
			const progress = Math.min(1, (now - startedAt) / durationMs);
			try {
				audio.volume = progress;
			} catch {
				return; // iOS: volume is read-only — plays at full volume
			}
			if (progress < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}

	function toggle() {
		if (!audio) return;
		muted = !muted;
		audio.muted = muted;
	}

	function onVisibilityChange() {
		if (!audio || !started) return;
		if (document.hidden) {
			audio.pause();
		} else {
			void audio.play().catch(() => {});
		}
	}
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />

{#if src}
	<audio bind:this={audio} {src} loop preload="none"></audio>
	{#if started}
		<button
			class="audio-toggle"
			type="button"
			onclick={toggle}
			aria-label={muted ? unmuteLabel : muteLabel}
			aria-pressed={muted}
			title={muted ? unmuteLabel : muteLabel}
		>
			{#if muted}
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
					<path d="M16 8l5 8M21 8l-5 8" stroke="currentColor" stroke-width="1.8" fill="none" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
					<path
						d="M16.5 8.5a5 5 0 0 1 0 7M18.8 6.2a8 8 0 0 1 0 11.6"
						stroke="currentColor"
						stroke-width="1.8"
						fill="none"
						stroke-linecap="round"
					/>
				</svg>
			{/if}
		</button>
	{/if}
{/if}

<style>
	.audio-toggle {
		position: fixed;
		inset-block-end: calc(1.4rem + env(safe-area-inset-bottom, 0px));
		inset-inline-end: 1.4rem;
		z-index: 40;
		width: 2.9rem;
		height: 2.9rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 45%, transparent);
		background: color-mix(in srgb, var(--ei-bg) 82%, transparent);
		backdrop-filter: blur(6px);
		color: var(--ei-accent);
		cursor: pointer;
	}

	.audio-toggle:focus-visible {
		outline: 2px solid var(--ei-accent);
		outline-offset: 2px;
	}
</style>
