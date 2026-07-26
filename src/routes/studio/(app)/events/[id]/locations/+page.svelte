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
	{#if data.locations.length === 0}
		<div class="st-card">
			<p class="st-sub" style="margin:0">
				No stops yet — the day as guests will travel it: houses, ceremony, reception. Plain Google
				Maps links; no embeds, no API keys.
			</p>
		</div>
	{/if}

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
						>Label (English)
						<input name="labelEn" value={location.labelEn ?? ''} placeholder="Venue name" />
					</label>
					<label class="st-field"
						>Label (Arabic)
						<input name="labelAr" dir="rtl" value={location.labelAr ?? ''} />
					</label>
					<label class="st-field"
						>Label (French)
						<input name="labelFr" value={location.labelFr ?? ''} />
					</label>
					<label class="st-field"
						>Google Maps link<input
							name="mapsUrl"
							type="url"
							value={location.mapsUrl ?? ''}
						/></label
					>
					<label class="st-field"
						>Time (on {eventDay})<input
							name="startsTime"
							type="time"
							value={timeOf(location.startsAt)}
						/></label
					>
					<label class="st-field"
						>Order<input name="sort" type="number" value={location.sort} /></label
					>
					<label class="st-field"
						>Different day (optional)<input
							name="startsDate"
							type="date"
							value={dayOverrideOf(location.startsAt)}
						/></label
					>
				</div>
				<div class="row-actions">
					<button class="st-btn">Save this stop</button>
					<button class="st-btn danger" formaction="?/remove" formnovalidate>Remove</button>
				</div>
			</form>
		</div>
	{/each}

	<form method="POST" action="?/add" use:enhance>
		<button class="st-btn add-btn">＋ Add a stop</button>
	</form>
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

	.row-actions {
		display: flex;
		gap: 0.6rem;
		border-top: 1px solid var(--st-border);
		padding-top: 1rem;
	}

	.add-btn {
		width: 100%;
		padding-block: 0.9rem;
		background: transparent;
		color: var(--st-accent-dark);
		border: 2px dashed var(--st-border);
	}

	.add-btn:hover {
		background: color-mix(in srgb, var(--st-accent) 8%, transparent);
	}
</style>
