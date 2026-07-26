<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import { t, type Lang } from '$lib/i18n';

	type LocationRow = {
		id: string;
		kind: string;
		labelEn: string | null;
		labelAr: string | null;
		labelFr: string | null;
		mapsUrl: string | null;
		startsAt: string | null;
	};

	let { locations, lang }: { locations: LocationRow[]; lang: Lang } = $props();

	function label(location: LocationRow): string {
		const byLang: Record<Lang, string | null> = {
			ar: location.labelAr,
			fr: location.labelFr,
			en: location.labelEn
		};
		return (
			byLang[lang] ??
			location.labelEn ??
			location.labelFr ??
			location.labelAr ??
			t(lang, `locations.kind.${location.kind}`)
		);
	}

	const timeFormat = $derived(
		new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
			hour: 'numeric',
			minute: '2-digit'
		})
	);

	function timeOf(location: LocationRow): string | null {
		return location.startsAt ? timeFormat.format(new Date(location.startsAt)) : null;
	}
</script>

<div class="content" use:inview>
	<h2 class="heading">{t(lang, 'locations.title')}</h2>
	<!-- The day as a journey: an ordered list of 0..n typed stops (spec §2.3),
	     each a plain Google Maps link — no embeds, no API key (spec §8). -->
	<ol class="stops">
		{#each locations as location (location.id)}
			<li class="stop">
				<div class="marker" aria-hidden="true"></div>
				<div class="body">
					<p class="kind">{t(lang, `locations.kind.${location.kind}`)}</p>
					<p class="name">{label(location)}</p>
					{#if timeOf(location)}<p class="time">{timeOf(location)}</p>{/if}
					{#if location.mapsUrl}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Google Maps URL (spec §8: plain links, no embeds) -->
						<a class="maps" href={location.mapsUrl} target="_blank" rel="noopener noreferrer">
							{t(lang, 'locations.open_maps')} ↗
						</a>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</div>

<style>
	.content {
		width: min(30rem, 100%);
	}

	.heading {
		margin: 0 0 1.6rem;
		text-align: center;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	.stops {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.stop {
		position: relative;
		display: flex;
		gap: 1rem;
		padding-block: 0 1.7rem;
	}

	.stop:last-child {
		padding-block-end: 0;
	}

	.marker {
		flex: none;
		width: 0.65rem;
		height: 0.65rem;
		margin-block-start: 0.45rem;
		border-radius: 999px;
		border: 1.5px solid var(--ei-accent);
	}

	.stop:not(:last-child) .marker::after {
		content: '';
		position: absolute;
		inset-block: 1.2rem 0.2rem;
		inset-inline-start: 0.28rem;
		width: 1px;
		background: color-mix(in srgb, var(--ei-accent) 35%, transparent);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.kind {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		color: var(--ei-accent);
	}

	.name {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.25rem;
	}

	.time {
		margin: 0;
		color: var(--ei-muted);
		font-variant-numeric: tabular-nums;
	}

	.maps {
		margin-block-start: 0.35rem;
		align-self: flex-start;
		font-size: 0.85rem;
		color: var(--ei-accent);
		text-decoration: none;
		border-bottom: 1px solid color-mix(in srgb, var(--ei-accent) 50%, transparent);
		padding-block-end: 1px;
	}

	.maps:focus-visible {
		outline: 2px solid var(--ei-accent);
		outline-offset: 2px;
	}
</style>
