<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const event = $derived(data.event);
	// datetime-local wants "YYYY-MM-DDTHH:mm" without offset
	const dateLocal = $derived(event.dateMain.slice(0, 16));
</script>

<svelte:head><title>Details — EInvite Studio</title></svelte:head>

<div class="cols">
	<div class="st-card">
		<h2 class="st-h1">Details</h2>
		{#if form?.error}<p class="st-error">{form.error}</p>{/if}
		{#if form?.saved}<p class="st-success">Saved.</p>{/if}

		<form method="POST" action="?/update" use:enhance>
			<label class="st-field"
				>Title (English)<input name="titleEn" value={event.titleEn ?? ''} /></label
			>
			<label class="st-field"
				>Title (Arabic)<input name="titleAr" dir="rtl" value={event.titleAr ?? ''} /></label
			>
			<label class="st-field"
				>Title (French)<input name="titleFr" value={event.titleFr ?? ''} /></label
			>
			<label class="st-field"
				>Main date &amp; time<input
					name="dateMain"
					type="datetime-local"
					value={dateLocal}
					required
				/></label
			>
			<label class="st-field"
				>Type
				<select name="type" value={event.type}>
					<option value="wedding">Wedding</option>
					<option value="engagement">Engagement</option>
					<option value="baptism">Baptism</option>
					<option value="birthday">Birthday</option>
					<option value="corporate">Corporate</option>
				</select>
			</label>
			<fieldset class="langs">
				<legend>Languages</legend>
				{#each [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']] as [code, label] (code)}
					<label>
						<input
							type="checkbox"
							name="languages"
							value={code}
							checked={event.languages.includes(code)}
						/>
						{label}
					</label>
				{/each}
			</fieldset>
			<label class="st-field"
				>Payment (recorded manually — no billing engine)
				<select name="paymentStatus" value={event.paymentStatus}>
					<option value="pending">Pending</option>
					<option value="deposit">Deposit received</option>
					<option value="paid">Paid</option>
				</select>
			</label>
			<label class="st-field"
				>Guest-data retention (months after the event)
				<input
					name="retentionMonths"
					type="number"
					min="1"
					max="36"
					value={event.retentionMonths}
				/>
			</label>
			<button class="st-btn">Save details</button>
		</form>
	</div>

	<div class="st-card">
		<h2 class="st-h1">Status</h2>
		<p class="st-sub">
			Guests can only open <strong>live</strong> events. Archiving hides the pages; guest data is
			purged automatically {event.retentionMonths} months after the date.
		</p>
		<form method="POST" action="?/status" use:enhance class="status-form">
			{#if event.status !== 'live'}
				<button class="st-btn" name="to" value="live">Go live</button>
			{/if}
			{#if event.status !== 'draft'}
				<button class="st-btn secondary" name="to" value="draft">Back to draft</button>
			{/if}
			{#if event.status !== 'archived'}
				<button class="st-btn danger" name="to" value="archived">Archive</button>
			{/if}
		</form>
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: 1fr;
	}

	@media (min-width: 58rem) {
		.cols {
			grid-template-columns: 1.6fr 1fr;
			align-items: start;
		}
	}

	.langs {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.7rem 0.9rem;
		margin: 0 0 1rem;
		display: flex;
		gap: 1rem;
		font-size: 0.9rem;
	}

	.langs legend {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--st-muted);
		padding-inline: 0.3rem;
	}

	.status-form {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
</style>
