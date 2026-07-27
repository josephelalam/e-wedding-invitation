<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import Icon from './Icon.svelte';
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
				<span class="badge"><Icon name={location.kind} /></span>
				<p class="kind">{t(lang, `locations.kind.${location.kind}`)}</p>
				<p class="name">{label(location)}</p>
				{#if timeOf(location)}<p class="time">{timeOf(location)}</p>{/if}
				{#if location.mapsUrl}
					<a class="maps" href={location.mapsUrl} target="_blank" rel="noopener noreferrer">
						{t(lang, 'locations.open_maps')}
					</a>
				{/if}
			</li>
		{/each}
	</ol>
</div>

<style>
	.content {
		width: min(30rem, 100%);
	}

	.heading {
		margin: 0 0 2.2rem;
		text-align: center;
		font-family: var(--ei-font-caps);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	.stops {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2.4rem;
	}

	.stop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		text-align: center;
	}

	/* separator flourish between stops — a hairline growing from a diamond */
	.stop + .stop {
		position: relative;
		padding-top: 2.4rem;
	}

	.stop + .stop::before {
		content: '';
		position: absolute;
		top: 0;
		inset-inline: 30%;
		height: 1px;
		background: linear-gradient(
			to right,
			transparent,
			color-mix(in srgb, var(--ei-accent) 40%, transparent),
			transparent
		);
	}

	.badge {
		display: grid;
		place-items: center;
		width: 3.6rem;
		height: 3.6rem;
		margin-bottom: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 45%, transparent);
		border-radius: 999px;
		color: var(--ei-accent);
	}

	.kind {
		margin: 0;
		font-family: var(--ei-font-body);
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.26em;
		text-indent: 0.26em;
		text-transform: uppercase;
		color: var(--ei-accent);
	}

	.name {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.45rem;
		line-height: 1.35;
		text-wrap: balance;
	}

	.time {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.95rem;
		color: var(--ei-muted);
		font-variant-numeric: tabular-nums;
	}

	.maps {
		margin-top: 0.7rem;
		font-family: var(--ei-font-body);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-indent: 0.22em;
		text-transform: uppercase;
		color: inherit;
		text-decoration: none;
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		padding: 0.6rem 1.4rem;
		transition: background-color 0.3s ease;
	}

	.maps:hover {
		background: color-mix(in srgb, currentColor 10%, transparent);
	}

	.maps:focus-visible {
		outline: 2px solid var(--ei-accent);
		outline-offset: 2px;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .heading,
	:global([dir='rtl']) .kind,
	:global([dir='rtl']) .maps {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
