<script lang="ts">
	// Thin line-art stationery icons (1.3px stroke, currentColor) — the same
	// engraved-icon language the premium invitation market speaks.
	let { name, size = 30 }: { name: string; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 32 32"
	fill="none"
	stroke="currentColor"
	stroke-width="1.3"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'house_groom' || name === 'house_bride'}
		<path d="M5 15.5 16 6l11 9.5" />
		<path d="M8 13.8V26h16V13.8" />
		<path d="M13.5 26v-7h5v7" />
	{:else if name === 'ceremony'}
		<path d="M16 3v5M13.8 5.5h4.4" />
		<path d="M16 8l-6 6v12h12V14z" />
		<path d="M10 17H6.5v9H10M22 17h3.5v9H22" />
		<path d="M14 26v-4.5a2 2 0 0 1 4 0V26" />
	{:else if name === 'reception'}
		<path d="M10.5 4h7l-1 8.5a2.6 2.6 0 0 1-5 0z" />
		<path d="M14 15v9M11 27h6" />
		<path d="M19 8.5h7l-1.4 7a2.6 2.6 0 0 1-4.8.6" />
		<path d="M21.8 18.5 20.5 27M17.6 27.4l6.6 1" />
		<path d="M12 7.2h4.2" />
	{:else if name === 'gift'}
		<rect x="6" y="12" width="20" height="14" rx="0.5" />
		<path d="M6 17h20M16 12v14" />
		<path
			d="M16 12c-4.5 0-7-1.6-7-3.7C9 6.6 10.4 6 11.6 6c2.5 0 4.4 3.4 4.4 6zm0 0c4.5 0 7-1.6 7-3.7C23 6.6 21.6 6 20.4 6 17.9 6 16 9.4 16 12z"
		/>
	{:else if name === 'rings'}
		<circle cx="12.5" cy="18" r="7.5" />
		<circle cx="19.5" cy="14" r="7.5" />
	{:else}
		<path d="M16 28s-8.5-8.2-8.5-14.3a8.5 8.5 0 0 1 17 0C24.5 19.8 16 28 16 28z" />
		<circle cx="16" cy="13.5" r="3" />
	{/if}
</svg>
