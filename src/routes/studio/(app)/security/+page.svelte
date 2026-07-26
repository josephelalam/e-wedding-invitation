<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { renderSVG } from 'uqr';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	const enabled = $derived(Boolean(page.data.owner?.twoFactorEnabled));

	let password = $state('');
	let code = $state('');
	let totpUri = $state('');
	let backupCodes = $state<string[]>([]);
	let errorMsg = $state('');
	let okMsg = $state('');
	let busy = $state(false);

	const qrSvg = $derived(totpUri ? renderSVG(totpUri, { border: 1 }) : '');

	async function startEnable(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		errorMsg = '';
		const { data, error } = await authClient.twoFactor.enable({ password });
		busy = false;
		if (error || !data) {
			errorMsg = 'Could not start enrollment — check your password.';
			return;
		}
		totpUri = data.totpURI;
		backupCodes = data.backupCodes ?? [];
	}

	async function confirmEnable(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		errorMsg = '';
		const { error } = await authClient.twoFactor.verifyTotp({ code });
		busy = false;
		if (error) {
			errorMsg = 'Code not accepted — scan the QR again and retry.';
			return;
		}
		okMsg = 'Two-factor is on. Store your backup codes somewhere safe.';
		totpUri = '';
		code = '';
		await invalidateAll();
	}

	async function disable(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		errorMsg = '';
		const { error } = await authClient.twoFactor.disable({ password });
		busy = false;
		if (error) {
			errorMsg = 'Could not disable — check your password.';
			return;
		}
		okMsg = 'Two-factor disabled.';
		await invalidateAll();
	}
</script>

<svelte:head><title>Security — EInvite Studio</title></svelte:head>

<div class="st-card" style="max-width:34rem">
	<h1 class="st-h1">Security</h1>
	<p class="st-sub">
		The owner account can read every guest list — it gets real protection (spec §4.4).
	</p>

	{#if errorMsg}<p class="st-error">{errorMsg}</p>{/if}
	{#if okMsg}<p class="st-success">{okMsg}</p>{/if}

	{#if enabled}
		<p>✅ Authenticator app is <strong>enabled</strong>.</p>
		<form onsubmit={disable}>
			<label class="st-field"
				>Password (to disable 2FA)
				<input type="password" bind:value={password} required autocomplete="current-password" />
			</label>
			<button class="st-btn danger" disabled={busy}>Disable two-factor</button>
		</form>
	{:else if totpUri}
		<ol>
			<li>Scan this QR with Google Authenticator / Aegis / 1Password:</li>
		</ol>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated locally by uqr from our own TOTP URI -->
		<div class="qr">{@html qrSvg}</div>
		{#if backupCodes.length}
			<p><strong>Backup codes</strong> (shown once — save them now):</p>
			<p>
				{#each backupCodes as backup (backup)}<code
						class="st-code"
						style="margin:0 .25rem .25rem 0; display:inline-block">{backup}</code
					>{/each}
			</p>
		{/if}
		<form onsubmit={confirmEnable}>
			<label class="st-field"
				>Enter the 6-digit code to confirm
				<input bind:value={code} required inputmode="numeric" pattern="[0-9]{6}" />
			</label>
			<button class="st-btn" disabled={busy}>Confirm & enable</button>
		</form>
	{:else}
		<form onsubmit={startEnable}>
			<label class="st-field"
				>Password
				<input type="password" bind:value={password} required autocomplete="current-password" />
			</label>
			<button class="st-btn" disabled={busy}>Enable authenticator app</button>
		</form>
	{/if}
</div>

<style>
	.qr {
		width: 200px;
		margin: 0.5rem 0 1rem;
	}
	.qr :global(svg) {
		width: 100%;
		height: auto;
	}
</style>
