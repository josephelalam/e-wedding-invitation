<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		errorMsg = '';
		const { data, error } = await authClient.signIn.email({ email, password });
		busy = false;
		if (error) {
			errorMsg = 'Sign-in failed. Check your email and password.';
			return;
		}
		// The twoFactor client plugin redirects to /studio/login/totp when needed.
		if (data && 'twoFactorRedirect' in data) return;
		await goto(resolve('/studio'), { invalidateAll: true });
	}
</script>

<svelte:head><title>Sign in — EInvite Studio</title></svelte:head>

<div class="st-card">
	<h1 class="st-h1">Owner sign-in</h1>
	<p class="st-sub">The studio is for the site owner. Couples use their dashboard link.</p>

	{#if page.url.searchParams.get('setup') === 'done'}
		<p class="st-success">Owner account created — sign in below.</p>
	{/if}
	{#if errorMsg}<p class="st-error">{errorMsg}</p>{/if}

	<form onsubmit={submit}>
		<label class="st-field"
			>Email
			<input type="email" bind:value={email} required autocomplete="email" />
		</label>
		<label class="st-field"
			>Password
			<input type="password" bind:value={password} required autocomplete="current-password" />
		</label>
		<button class="st-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
	</form>
</div>
