<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();

	const KINDS = [
		['house_groom', "Groom's house"],
		['house_bride', "Bride's house"],
		['ceremony', 'Ceremony'],
		['reception', 'Reception'],
		['other', 'Other']
	] as const;

	// Keep what the owner typed after saving (enhance would otherwise reset
	// inputs to their mount-time defaults — empty).
	const keepValues: SubmitFunction = () => {
		return async ({ update }) => {
			await update({ reset: false });
		};
	};

	const eventDay = $derived(data.event.dateMain.slice(0, 10));

	function timeOf(startsAt: string | null): string {
		return startsAt?.slice(11, 16) ?? '';
	}

	function dayOverrideOf(startsAt: string | null): string {
		if (!startsAt) return '';
		const day = startsAt.slice(0, 10);
		return day === eventDay ? '' : day;
	}
</script>

<svelte:head><title>Locations — EInvite Studio</title></svelte:head>

{#if form?.error}<p class="st-error">{form.error}</p>{/if}
{#if form?.saved}<p class="st-success">Saved.</p>{/if}

<div class="stack">
	{#each data.locations as location, index (location.id)}
		<div class="st-card">
			<p class="stop-title">Stop {index + 1}</p>
			<form method="POST" action="?/save" use:enhance={keepValues}>
				<input type="hidden" name="id" value={location.id} />
				<div class="loc-grid">
					<label class="st-field"
						>Kind
						<select name="kind" value={location.kind}>
							{#each KINDS as [value, label] (value)}<option {value}>{label}</option>{/each}
						</select>
					</label>
					<label class="st-field"
						>Label
						<input name="labelEn" value={location.labelEn ?? ''} placeholder="Venue name" />
					</label>
					<label class="st-field"
						>Google Maps link<input
							name="mapsUrl"
							type="url"
							value={location.mapsUrl ?? ''}
						/></label
					>
					<label class="st-field"
						>Time (on the event day, {eventDay})<input
							name="startsTime"
							type="time"
							value={timeOf(location.startsAt)}
						/></label
					>
					<label class="st-field"
						>Order<input name="sort" type="number" value={location.sort} /></label
					>
				</div>
				<details
					class="translations"
					open={Boolean(location.labelAr || location.labelFr || dayOverrideOf(location.startsAt))}
				>
					<summary>Translations &amp; different day (optional)</summary>
					<div class="loc-grid">
						<label class="st-field"
							>Label (Arabic)<input
								name="labelAr"
								dir="rtl"
								value={location.labelAr ?? ''}
							/></label
						>
						<label class="st-field"
							>Label (French)<input name="labelFr" value={location.labelFr ?? ''} /></label
						>
						<label class="st-field"
							>Different day<input
								name="startsDate"
								type="date"
								value={dayOverrideOf(location.startsAt)}
							/></label
						>
					</div>
				</details>
				<div class="row-actions">
					<button class="st-btn">Save this stop</button>
					<button class="st-btn danger" formaction="?/remove" formnovalidate>Remove</button>
				</div>
			</form>
		</div>
	{/each}

	<div class="st-card add-card">
		<h2 class="st-h1">Add a stop</h2>
		<p class="st-sub">
			The day as guests will travel it — houses, ceremony, reception. Plain Google Maps links; no
			embeds, no API keys.
		</p>
		<form method="POST" action="?/save" use:enhance>
			<div class="loc-grid">
				<label class="st-field"
					>Kind
					<select name="kind">
						{#each KINDS as [value, label] (value)}<option {value}>{label}</option>{/each}
					</select>
				</label>
				<label class="st-field">Label<input name="labelEn" placeholder="Venue name" /></label>
				<label class="st-field">Google Maps link<input name="mapsUrl" type="url" /></label>
				<label class="st-field"
					>Time (on the event day, {eventDay})<input name="startsTime" type="time" /></label
				>
				<label class="st-field"
					>Order<input name="sort" type="number" value={data.locations.length + 1} /></label
				>
			</div>
			<details class="translations">
				<summary>Translations &amp; different day (optional)</summary>
				<div class="loc-grid">
					<label class="st-field">Label (Arabic)<input name="labelAr" dir="rtl" /></label>
					<label class="st-field">Label (French)<input name="labelFr" /></label>
					<label class="st-field">Different day<input name="startsDate" type="date" /></label>
				</div>
			</details>
			<button class="st-btn">Add stop</button>
		</form>
	</div>
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.stop-title {
		margin: 0 0 0.8rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--st-muted);
	}

	.loc-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0 1rem;
	}

	.translations {
		margin: 0 0 1rem;
	}

	.translations summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--st-accent-dark);
		margin-bottom: 0.6rem;
	}

	.row-actions {
		display: flex;
		gap: 0.6rem;
		border-top: 1px solid var(--st-border);
		padding-top: 1rem;
	}

	.add-card {
		border-style: dashed;
	}
</style>
