<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let code = $state('');
	let useBackup = $state(false);
	let errorMsg = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		errorMsg = '';
		const { error } = useBackup
			? await authClient.twoFactor.verifyBackupCode({ code })
			: await authClient.twoFactor.verifyTotp({ code });
		busy = false;
		if (error) {
			errorMsg = 'That code was not accepted. Try again.';
			return;
		}
		await goto(resolve('/studio'), { invalidateAll: true });
	}
</script>

<svelte:head><title>Two-factor — EInvite Studio</title></svelte:head>

<div class="st-card">
	<h1 class="st-h1">Two-factor check</h1>
	<p class="st-sub">
		{useBackup
			? 'Enter one of your backup codes.'
			: 'Enter the 6-digit code from your authenticator app.'}
	</p>

	{#if errorMsg}<p class="st-error">{errorMsg}</p>{/if}

	<form onsubmit={submit}>
		<label class="st-field"
			>{useBackup ? 'Backup code' : 'Authenticator code'}
			<input
				bind:value={code}
				required
				autocomplete="one-time-code"
				inputmode={useBackup ? 'text' : 'numeric'}
				pattern={useBackup ? undefined : '[0-9]{6}'}
			/>
		</label>
		<button class="st-btn" disabled={busy}>{busy ? 'Checking…' : 'Verify'}</button>
		<button
			type="button"
			class="st-btn secondary"
			style="margin-inline-start:.5rem"
			onclick={() => (useBackup = !useBackup)}
		>
			{useBackup ? 'Use authenticator code' : 'Use a backup code'}
		</button>
	</form>
</div>
