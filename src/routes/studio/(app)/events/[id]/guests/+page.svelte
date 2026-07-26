<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { renderSVG } from 'uqr';

	let { data, form } = $props();

	let qrFor = $state<string | null>(null);
	let copied = $state<string | null>(null);

	function cardUrl(token: string): string {
		return `${data.origin}/e/${data.event.slug}/i/${token}`;
	}

	function waLink(phone: string, token: string): string {
		return `https://wa.me/${phone}?text=${encodeURIComponent(cardUrl(token))}`;
	}

	async function copy(token: string) {
		try {
			await navigator.clipboard.writeText(cardUrl(token));
			copied = token;
			setTimeout(() => (copied = null), 1500);
		} catch {
			// clipboard unavailable — the URL is visible in the QR panel
		}
	}
</script>

<svelte:head><title>Guests — EInvite Studio</title></svelte:head>

<div class="st-card" style="margin-bottom:1.25rem">
	<h2 class="st-h1">Import guest list</h2>
	<p class="st-sub">
		One card per line: <code class="st-code">name, seats, phone, lang, group</code> — only name and
		seats are required. Quotes protect commas in names:
		<code class="st-code">"Karam, Elie &amp; Maya",3</code>
	</p>

	{#if form?.importError}<p class="st-error">{form.importError}</p>{/if}
	{#if form?.imported !== undefined}
		<p class="st-success">
			{form.imported} card{form.imported === 1 ? '' : 's'} created.
			{#if form.importErrors?.length}Skipped: {form.importErrors.join(' · ')}{/if}
		</p>
	{/if}

	<form method="POST" action="?/import" use:enhance>
		<label class="st-field"
			>Paste lines or CSV
			<textarea
				name="csv"
				rows="5"
				placeholder="Teta Georgette,1,,ar&#10;&quot;Karam, Elie &amp; Maya&quot;,3,+9613123456,fr,family"
			></textarea>
		</label>
		<button class="st-btn">Import</button>
	</form>
</div>

<div class="st-card" style="margin-bottom:1.25rem">
	<h2 class="st-h1">Couple dashboard access</h2>
	<p class="st-sub">
		<strong>No email is sent</strong> (the $0 setup has no email service) — this creates the
		couple's account and puts their sign-in link in the
		<a href={resolve('/studio/outbox')}>Outbox</a>, ready to forward on WhatsApp.
	</p>
	{#if form?.coupleError}<p class="st-error">{form.coupleError}</p>{/if}
	{#if form?.coupleLinked}
		<p class="st-success">
			{form.coupleLinked}
			<a href={resolve('/studio/outbox')} style="font-weight:600">Open Outbox →</a>
		</p>
	{/if}
	<form method="POST" action="?/coupleLogin" use:enhance class="couple-form">
		<label class="st-field">Couple name<input name="name" placeholder="Elie &amp; Maya" /></label>
		<label class="st-field"
			>Couple email<input
				name="email"
				type="email"
				required
				placeholder="couple@example.com"
			/></label
		>
		<button class="st-btn">Create sign-in link</button>
	</form>
</div>

<div class="st-card">
	<h2 class="st-h1">Cards ({data.invitations.length})</h2>
	{#if data.invitations.length === 0}
		<p>No cards yet — import the guest list above.</p>
	{:else}
		<table class="st-table">
			<thead>
				<tr><th>Guest</th><th>Seats</th><th>Lang</th><th>Share</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.invitations as invitation (invitation.id)}
					<tr class:revoked={invitation.revoked}>
						<td>
							{invitation.guestLabel}
							{#if invitation.groupTag}<span class="tag">{invitation.groupTag}</span>{/if}
							{#if invitation.revoked}<span class="tag revoked-tag">revoked</span>{/if}
						</td>
						<td>{invitation.maxSeats}</td>
						<td>{invitation.lang ?? '—'}</td>
						<td class="share">
							<button class="st-btn secondary" type="button" onclick={() => copy(invitation.token)}>
								{copied === invitation.token ? 'Copied ✓' : 'Copy link'}
							</button>
							{#if invitation.phone}
								<a
									class="st-btn secondary"
									href={waLink(invitation.phone, invitation.token)}
									target="_blank"
									rel="noopener noreferrer">WhatsApp</a
								>
							{/if}
							<button
								class="st-btn secondary"
								type="button"
								onclick={() => (qrFor = qrFor === invitation.token ? null : invitation.token)}
							>
								QR
							</button>
						</td>
						<td>
							<form method="POST" action="?/revoke" use:enhance>
								<input type="hidden" name="id" value={invitation.id} />
								<input type="hidden" name="revoked" value={String(!invitation.revoked)} />
								<button class="st-btn {invitation.revoked ? '' : 'danger'}">
									{invitation.revoked ? 'Reactivate' : 'Revoke'}
								</button>
							</form>
						</td>
					</tr>
					{#if qrFor === invitation.token}
						<tr>
							<td colspan="5" class="qr-cell">
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated locally by uqr from our own URL -->
								<div class="qr">{@html renderSVG(cardUrl(invitation.token), { border: 1 })}</div>
								<code class="st-code">{cardUrl(invitation.token)}</code>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.couple-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1rem;
		align-items: end;
	}

	.tag {
		display: inline-block;
		margin-inline-start: 0.4rem;
		font-size: 0.68rem;
		letter-spacing: 0.05em;
		background: #efeae2;
		color: var(--st-muted);
		border-radius: 5px;
		padding: 0.1rem 0.4rem;
	}

	.revoked-tag {
		background: #fbeae9;
		color: var(--st-danger);
	}

	tr.revoked td {
		opacity: 0.55;
	}

	.share {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.share :global(.st-btn) {
		padding: 0.35rem 0.7rem;
		font-size: 0.78rem;
		text-decoration: none;
	}

	.qr-cell {
		background: #faf8f4;
	}

	.qr {
		width: 150px;
		margin-bottom: 0.5rem;
	}

	.qr :global(svg) {
		width: 100%;
		height: auto;
	}
</style>
