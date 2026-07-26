<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Owner setup — EInvite Studio</title></svelte:head>

<div class="st-card">
	<h1 class="st-h1">Create the owner account</h1>
	<p class="st-sub">
		One-time setup. This account manages every event and is protected by password + authenticator
		app.
	</p>

	{#if form?.error}<p class="st-error">{form.error}</p>{/if}

	<form
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update();
			};
		}}
	>
		<label class="st-field"
			>Your name
			<input name="name" required maxlength="100" autocomplete="name" />
		</label>
		<label class="st-field"
			>Email
			<input name="email" type="email" required autocomplete="email" />
		</label>
		<label class="st-field"
			>Password (min 12 characters)
			<input name="password" type="password" required minlength="12" autocomplete="new-password" />
		</label>
		<button class="st-btn" disabled={busy}>{busy ? 'Creating…' : 'Create owner account'}</button>
	</form>

	<p class="st-sub" style="margin-top:1rem">
		Next: sign in, then enable the authenticator app under Studio → Security.
	</p>
</div>
