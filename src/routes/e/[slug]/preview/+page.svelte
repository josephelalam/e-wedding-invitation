<script lang="ts">
	import InvitationPage from '$lib/components/InvitationPage.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Preview — {data.event.slug}</title></svelte:head>

<div class="preview-banner">Preview — guests see their own name here</div>
<InvitationPage {data} preview />

<style>
	.preview-banner {
		position: fixed;
		z-index: 50;
		inset-block-start: 0;
		inset-inline: 0;
		text-align: center;
		font:
			600 0.72rem system-ui,
			sans-serif;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: rgba(45, 42, 38, 0.82);
		padding: 0.3rem;
	}
</style>
