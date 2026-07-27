<script lang="ts">
	import '$lib/styles/fonts.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	/* App-wide base: guest pages had no reset, so content-box + the default
	   body margin skewed every 100%-width layout (the horizontal deck made it
	   visible: scenes rendered padding wider than their track). */
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
	}
</style>
