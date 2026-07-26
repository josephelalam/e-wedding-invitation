<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const KINDS = [
		['house_groom', "Groom's house"],
		['house_bride', "Bride's house"],
		['ceremony', 'Ceremony'],
		['reception', 'Reception'],
		['other', 'Other']
	] as const;
</script>

<svelte:head><title>Locations — EInvite Studio</title></svelte:head>

{#if form?.error}<p class="st-error">{form.error}</p>{/if}

<div class="stack">
	{#each data.locations as location (location.id)}
		<div class="st-card">
			<form method="POST" action="?/save" use:enhance class="loc-form">
				<input type="hidden" name="id" value={location.id} />
				<label class="st-field"
					>Kind
					<select name="kind" value={location.kind}>
						{#each KINDS as [value, label] (value)}<option {value}>{label}</option>{/each}
					</select>
				</label>
				<label class="st-field"
					>Label (EN)<input name="labelEn" value={location.labelEn ?? ''} /></label
				>
				<label class="st-field"
					>Label (AR)<input name="labelAr" dir="rtl" value={location.labelAr ?? ''} /></label
				>
				<label class="st-field"
					>Label (FR)<input name="labelFr" value={location.labelFr ?? ''} /></label
				>
				<label class="st-field"
					>Google Maps link<input name="mapsUrl" type="url" value={location.mapsUrl ?? ''} /></label
				>
				<label class="st-field"
					>Time<input
						name="startsAt"
						type="datetime-local"
						value={location.startsAt?.slice(0, 16) ?? ''}
					/></label
				>
				<label class="st-field"
					>Order<input name="sort" type="number" value={location.sort} /></label
				>
				<div class="row-actions">
					<button class="st-btn">Save</button>
					<button class="st-btn danger" formaction="?/remove">Remove</button>
				</div>
			</form>
		</div>
	{/each}

	<div class="st-card">
		<h2 class="st-h1">Add a stop</h2>
		<p class="st-sub">
			The day as guests will travel it — houses, ceremony, reception. Plain Google Maps links; no
			embeds, no API keys.
		</p>
		<form method="POST" action="?/save" use:enhance class="loc-form">
			<label class="st-field"
				>Kind
				<select name="kind">
					{#each KINDS as [value, label] (value)}<option {value}>{label}</option>{/each}
				</select>
			</label>
			<label class="st-field">Label (EN)<input name="labelEn" /></label>
			<label class="st-field">Label (AR)<input name="labelAr" dir="rtl" /></label>
			<label class="st-field">Label (FR)<input name="labelFr" /></label>
			<label class="st-field">Google Maps link<input name="mapsUrl" type="url" /></label>
			<label class="st-field">Time<input name="startsAt" type="datetime-local" /></label>
			<label class="st-field"
				>Order<input name="sort" type="number" value={data.locations.length + 1} /></label
			>
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

	.loc-form {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0 1rem;
		align-items: end;
	}

	.row-actions {
		display: flex;
		gap: 0.6rem;
		margin-bottom: 0.9rem;
	}
</style>
