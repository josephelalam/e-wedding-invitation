<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Music — EInvite Studio</title></svelte:head>

<div class="st-card" style="max-width:38rem">
	<h2 class="st-h1">Music</h2>
	<p class="st-sub">
		One track per event. It starts when the guest opens the envelope — the only upload in the whole
		platform.
	</p>

	{#if form?.error}<p class="st-error">{form.error}</p>{/if}
	{#if form?.saved}<p class="st-success">Saved.</p>{/if}

	{#if data.musicKey}
		<p><strong>Current track:</strong> <code class="st-code">{data.musicKey}</code></p>
		<audio controls src="/api/media/{data.musicKey}" preload="none"></audio>
		<form method="POST" action="?/remove" use:enhance style="margin-top:1rem">
			<button class="st-btn danger">Remove track</button>
		</form>
		<hr style="border:none;border-top:1px solid var(--st-border);margin:1.4rem 0" />
	{/if}

	<form
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update();
			};
		}}
	>
		<label class="st-field"
			>{data.musicKey ? 'Replace track' : 'Upload track'} (MP3/AAC ~128 kbps, max 8 MB)
			<input type="file" name="track" accept="audio/*" required />
		</label>
		<button class="st-btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
	</form>

	<p class="license-note">
		⚖️ Playing commercial pop tracks on a public page carries copyright exposure. Default to
		royalty-free or licensed instrumental versions; couple-supplied audio is accepted at the
		couple's responsibility (spec §3.1.6).
	</p>
</div>

<style>
	audio {
		width: 100%;
	}

	.license-note {
		margin-top: 1.4rem;
		font-size: 0.8rem;
		line-height: 1.6;
		color: var(--st-muted);
		background: #f4f1ec;
		border-radius: 8px;
		padding: 0.7rem 0.9rem;
	}
</style>
