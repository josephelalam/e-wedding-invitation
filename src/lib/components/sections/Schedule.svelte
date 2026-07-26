<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import { t, type Lang } from '$lib/i18n';
	import type { ExtraDate } from '$lib/types';

	let { datesExtra, lang }: { datesExtra: ExtraDate[]; lang: Lang } = $props();

	const dateFormat = $derived(
		new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			hour: 'numeric',
			minute: '2-digit'
		})
	);
</script>

<div class="content" use:inview>
	<h2 class="heading">{t(lang, 'schedule.title')}</h2>
	<ul class="entries">
		{#each datesExtra as entry, index (index)}
			<li class="entry">
				<p class="label">
					{entry.label[lang] ?? entry.label.en ?? entry.label.fr ?? entry.label.ar}
				</p>
				<p class="when">{dateFormat.format(new Date(entry.at))}</p>
			</li>
		{/each}
	</ul>
</div>

<style>
	.content {
		width: min(28rem, 100%);
		text-align: center;
	}

	.heading {
		margin: 0 0 1.6rem;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.entry {
		border: 1px solid color-mix(in srgb, var(--ei-accent) 30%, transparent);
		border-radius: 10px;
		padding: 1rem 1.2rem;
	}

	.label {
		margin: 0 0 0.2rem;
		font-family: var(--ei-font-display);
		font-size: 1.2rem;
	}

	.when {
		margin: 0;
		color: var(--ei-muted);
		font-size: 0.95rem;
	}
</style>
