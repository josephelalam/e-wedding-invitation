<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let creating = $state(false);

	const dateFormat = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
</script>

<svelte:head><title>Events — EInvite Studio</title></svelte:head>

<div class="grid">
	<div class="st-card">
		<h1 class="st-h1">Events</h1>
		<p class="st-sub">Every wedding (or baptism, or birthday) is a row + a theme.</p>

		{#if data.events.length === 0}
			<p class="st-empty">No events yet. Create the first one on the right.</p>
		{:else}
			<table class="st-table">
				<thead>
					<tr><th>Event</th><th>Date</th><th>Status</th><th>RSVPs</th><th>Payment</th></tr>
				</thead>
				<tbody>
					{#each data.events as event (event.id)}
						<tr>
							<td>
								<a class="ev-link" href={resolve('/studio/(app)/events/[id]', { id: event.id })}>
									{event.title}
								</a>
								<div class="slug">/{event.slug}</div>
							</td>
							<td class="nowrap">{dateFormat.format(new Date(event.dateMain))}</td>
							<td><span class="st-pill {event.status}">{event.status}</span></td>
							<td class="nowrap">
								<strong>{event.stats.confirmedSeats}</strong> seats
								<span class="counts">
									<span class="c-ok">{event.stats.confirmedCards}✓</span>
									<span class="c-bad">{event.stats.declinedCards}✗</span>
									<span class="c-wait">{event.stats.pendingCards}…</span>
								</span>
							</td>
							<td><span class="st-pill {event.paymentStatus}">{event.paymentStatus}</span></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="st-card create">
		<h2 class="st-h1">New event</h2>
		{#if form?.error}<p class="st-error">{form.error}</p>{/if}
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				creating = true;
				return async ({ update }) => {
					creating = false;
					await update();
				};
			}}
		>
			<label class="st-field"
				>Link name (kebab-case)
				<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="elie-and-maya" />
			</label>
			<label class="st-field"
				>Title (English)
				<input name="titleEn" required placeholder="Elie &amp; Maya" />
			</label>
			<label class="st-field"
				>Title (Arabic)
				<input name="titleAr" dir="rtl" placeholder="إيلي ومايا" />
			</label>
			<label class="st-field"
				>Title (French)
				<input name="titleFr" placeholder="Elie &amp; Maya" />
			</label>
			<label class="st-field"
				>Main date &amp; time
				<input name="dateMain" type="datetime-local" required />
			</label>
			<label class="st-field"
				>Type
				<select name="type">
					<option value="wedding">Wedding</option>
					<option value="engagement">Engagement</option>
					<option value="baptism">Baptism</option>
					<option value="birthday">Birthday</option>
					<option value="corporate">Corporate</option>
				</select>
			</label>
			<fieldset class="langs">
				<legend>Languages (first checked = default)</legend>
				<label><input type="checkbox" name="languages" value="ar" checked /> العربية</label>
				<label><input type="checkbox" name="languages" value="fr" checked /> Français</label>
				<label><input type="checkbox" name="languages" value="en" checked /> English</label>
			</fieldset>
			<button class="st-btn" disabled={creating}>{creating ? 'Creating…' : 'Create event'}</button>
		</form>
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}

	@media (min-width: 60rem) {
		.grid {
			grid-template-columns: 1.7fr 1fr;
			align-items: start;
		}
	}

	.ev-link {
		font-weight: 600;
		color: var(--st-accent-dark);
		text-decoration: none;
	}

	.ev-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.slug {
		color: var(--st-muted);
		font-size: 0.78rem;
	}

	.nowrap {
		white-space: nowrap;
	}

	.counts {
		margin-inline-start: 0.45rem;
		font-size: 0.82rem;
	}

	.counts span {
		margin-inline-end: 0.35rem;
	}

	.c-ok {
		color: var(--st-ok);
	}

	.c-bad {
		color: var(--st-danger);
	}

	.c-wait {
		color: var(--st-muted);
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
</style>
