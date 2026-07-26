<script lang="ts">
	import '$lib/styles/studio.css';
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import { t, dirFor, type Lang } from '$lib/i18n';

	let { data, form } = $props();

	const lang = $derived(data.lang as Lang);
	const dir = $derived(dirFor(lang));

	let copied = $state<string | null>(null);

	function cardUrl(token: string): string {
		return `${data.origin}/e/${data.event.slug}/i/${token}`;
	}

	async function copy(token: string) {
		try {
			await navigator.clipboard.writeText(cardUrl(token));
			copied = token;
			setTimeout(() => (copied = null), 1500);
		} catch {
			// clipboard unavailable — WhatsApp button still carries the link
		}
	}

	const title = $derived.by(() => {
		const byLang: Record<Lang, string | null> = {
			ar: data.event.titleAr,
			fr: data.event.titleFr,
			en: data.event.titleEn
		};
		return byLang[lang] ?? data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? '';
	});

	const filters = ['all', 'confirmed', 'declined', 'pending'] as const;

	async function signOut() {
		await authClient.signOut();
		window.location.href = '/dash/login';
	}

	function filterHref(status: string): string {
		const parts: string[] = [];
		if (status !== 'all') parts.push(`status=${status}`);
		if (data.filter.q) parts.push(`q=${encodeURIComponent(data.filter.q)}`);
		if (data.languages.length > 1) parts.push(`lang=${lang}`);
		return parts.length ? `?${parts.join('&')}` : '?';
	}
</script>

<svelte:head><title>{t(lang, 'dash.title')} — {title}</title></svelte:head>

<main class="dash" {dir} {lang}>
	<header>
		<div>
			<h1 class="st-h1">{title}</h1>
			<p class="st-sub" style="margin:0">{t(lang, 'dash.title')}</p>
		</div>
		<div class="head-actions">
			{#each data.languages as code (code)}
				{#if code !== lang}
					<a class="lang-link" href="?lang={code}">{code === 'ar' ? 'ع' : code}</a>
				{/if}
			{/each}
			<a class="st-btn secondary" href="/api/events/{data.event.id}/export.csv" download>
				{t(lang, 'dash.export')}
			</a>
			<button class="st-btn secondary" onclick={signOut}>{t(lang, 'dash.logout')}</button>
		</div>
	</header>

	<div class="tiles">
		<div class="tile">
			<span class="num">{data.stats.cards}</span><span class="lbl"
				>{t(lang, 'dash.stats.cards')}</span
			>
		</div>
		<div class="tile ok">
			<span class="num">{data.stats.confirmedSeats}</span><span class="lbl"
				>{t(lang, 'dash.stats.seats')}</span
			>
		</div>
		<div class="tile ok">
			<span class="num">{data.stats.confirmedCards}</span><span class="lbl"
				>{t(lang, 'dash.stats.confirmed')}</span
			>
		</div>
		<div class="tile no">
			<span class="num">{data.stats.declinedCards}</span><span class="lbl"
				>{t(lang, 'dash.stats.declined')}</span
			>
		</div>
		<div class="tile wait">
			<span class="num">{data.stats.pendingCards}</span><span class="lbl"
				>{t(lang, 'dash.stats.pending')}</span
			>
		</div>
	</div>

	<div class="st-card" style="margin-bottom:1.25rem">
		<h2 class="st-h1">{t(lang, 'dash.import.title')}</h2>
		<p class="st-sub">{t(lang, 'dash.import.hint')}</p>
		{#if form?.imported !== undefined}
			<p class="st-success">
				{t(lang, 'dash.import.done', { count: form.imported })}
				{#if form.importErrors?.length}
					{t(lang, 'dash.import.skipped', { lines: form.importErrors.join(' · ') })}
				{/if}
			</p>
		{/if}
		<form method="POST" action="?/import" use:enhance>
			<label class="st-field"
				><span class="visually-hidden">{t(lang, 'dash.import.title')}</span>
				<textarea
					name="csv"
					rows="3"
					placeholder="Teta Georgette,1,9613111222,ar,family&#10;&quot;Karam, Elie &amp; Maya&quot;,3,+9613123456,fr,friends"
				></textarea>
			</label>
			<button class="st-btn">{t(lang, 'dash.import.button')}</button>
		</form>
	</div>

	<div class="st-card">
		<div class="controls">
			<nav class="filters">
				{#each filters as status (status)}
					<a href={filterHref(status)} class:active={data.filter.status === status}>
						{t(lang, `dash.filter.${status}`)}
					</a>
				{/each}
			</nav>
			<form method="GET" class="search">
				{#if data.filter.status !== 'all'}<input
						type="hidden"
						name="status"
						value={data.filter.status}
					/>{/if}
				{#if data.languages.length > 1}<input type="hidden" name="lang" value={lang} />{/if}
				<input name="q" value={data.filter.q} placeholder={t(lang, 'dash.search')} />
			</form>
		</div>

		<table class="st-table">
			<thead>
				<tr>
					<th>{t(lang, 'dash.table.guest')}</th>
					<th>{t(lang, 'dash.table.seats')}</th>
					<th>{t(lang, 'dash.table.status')}</th>
					<th>{t(lang, 'dash.table.note')}</th>
					<th>{t(lang, 'dash.table.answered')}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as row (row.invitationId)}
					<tr>
						<td>{row.guestLabel}</td>
						<td>
							{#if row.status === 'confirmed'}{row.confirmedSeats}/{row.maxSeats}{:else}{row.maxSeats}{/if}
						</td>
						<td>
							<span class="badge {row.status}">{t(lang, `dash.status.${row.status}`)}</span>
						</td>
						<td class="note">{row.note ?? ''}</td>
						<td>
							{row.answeredAt
								? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
										day: 'numeric',
										month: 'short'
									}).format(new Date(row.answeredAt))
								: '—'}
						</td>
						<td class="share">
							{#if !row.revoked}
								<button class="st-btn secondary" type="button" onclick={() => copy(row.token)}>
									{copied === row.token ? t(lang, 'dash.copied') : t(lang, 'dash.copy')}
								</button>
								{#if row.phone}
									<a
										class="st-btn secondary"
										href="https://wa.me/{row.phone}?text={encodeURIComponent(cardUrl(row.token))}"
										target="_blank"
										rel="noopener noreferrer">{t(lang, 'dash.whatsapp')}</a
									>
								{/if}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>

<style>
	.dash {
		width: min(64rem, 100%);
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}

	.head-actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.head-actions :global(a.st-btn) {
		text-decoration: none;
	}

	.lang-link {
		color: var(--st-muted);
		text-decoration: none;
		font-size: 0.85rem;
		text-transform: uppercase;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
		gap: 0.8rem;
		margin-bottom: 1.25rem;
	}

	.tile {
		background: var(--st-surface);
		border: 1px solid var(--st-border);
		border-radius: var(--st-radius);
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
	}

	.tile .num {
		font-size: 1.7rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.tile .lbl {
		font-size: 0.78rem;
		color: var(--st-muted);
	}

	.tile.ok .num {
		color: var(--st-ok);
	}

	.tile.no .num {
		color: var(--st-danger);
	}

	.tile.wait .num {
		color: var(--st-accent-dark);
	}

	.controls {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.9rem;
	}

	.filters {
		display: flex;
		gap: 0.3rem;
	}

	.filters a {
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		text-decoration: none;
		color: var(--st-muted);
		font-size: 0.85rem;
		border: 1px solid transparent;
	}

	.filters a.active {
		color: var(--st-accent-dark);
		border-color: var(--st-accent);
		background: color-mix(in srgb, var(--st-accent) 10%, transparent);
	}

	.search input {
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--st-border);
		border-radius: 999px;
		font: inherit;
		min-width: 13rem;
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
	}

	.badge.confirmed {
		background: #eaf4ec;
		color: var(--st-ok);
	}

	.badge.declined {
		background: #fbeae9;
		color: var(--st-danger);
	}

	.badge.pending {
		background: #f4f0e9;
		color: var(--st-muted);
	}

	.note {
		max-width: 18rem;
		font-size: 0.85rem;
		color: var(--st-muted);
	}

	.share {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.share :global(.st-btn) {
		padding: 0.3rem 0.65rem;
		font-size: 0.75rem;
		text-decoration: none;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	textarea {
		display: block;
		width: 100%;
		font: inherit;
		font-size: 0.9rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--st-border);
		border-radius: 8px;
		margin-bottom: 0.8rem;
		resize: vertical;
	}
</style>
