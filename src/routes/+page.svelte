<script lang="ts">
	// The storefront: one quiet page in the same stationery language the
	// invitations speak. No JS, no forms — a calling card.
	const templates = [
		{
			name: 'Signature Deck',
			line: 'Full-screen slides over a slow-breathing photo wall. Monochrome ivory, script names.',
			photo: '/photos/field-walk.jpg'
		},
		{
			name: 'Torn-Paper Story',
			line: 'A formal scrolling story — verse, families, photos torn like paper, falling petals.',
			photo: '/photos/rings-veil.jpg'
		},
		{
			name: 'Horizon',
			line: 'A sideways story — swipe through full-screen scenes to a tilted polaroid finale.',
			photo: '/photos/beach-sunset.jpg'
		}
	];

	const features = [
		['Personal links', 'Every guest opens their own name — one tap from WhatsApp.'],
		['Three languages', 'English, français, and true right-to-left العربية on one card.'],
		['Living RSVP', 'Answers land in your dashboard the moment they are sent.'],
		['Music on open', 'Your song begins when the envelope does.']
	];
</script>

<svelte:head>
	<title>EInvite — wedding invitations, beautifully told</title>
	<meta
		name="description"
		content="Personal digital wedding invitations: full-screen photography, music, RSVP — in English, French and Arabic."
	/>
</svelte:head>

<main>
	<section class="hero">
		<p class="eyebrow">EInvite · Digital Wedding Invitations</p>
		<h1>The invitation<br />they'll keep</h1>
		<p class="script">every love story, beautifully told</p>
		<p class="rule" aria-hidden="true"><span></span>✦<span></span></p>
		<p class="lede">
			A personal link for every guest. Photography, music, and a reply card — in English, French and
			Arabic.
		</p>
	</section>

	<section class="line" aria-label="Invitation styles">
		{#each templates as tpl (tpl.name)}
			<article class="tpl" style="background-image:url('{tpl.photo}')">
				<div class="tpl-veil"></div>
				<div class="tpl-body">
					<h2>{tpl.name}</h2>
					<p>{tpl.line}</p>
				</div>
			</article>
		{/each}
	</section>

	<section class="features">
		{#each features as [head, body] (head)}
			<div class="feature">
				<h3>{head}</h3>
				<p>{body}</p>
			</div>
		{/each}
	</section>

	<footer>
		<p class="colophon">einvite</p>
	</footer>
</main>

<style>
	main {
		--ink: #23201c;
		--ivory: #faf7f1;
		--gold: #b8966e;
		--taupe: #8f8577;
		min-height: 100dvh;
		background: var(--ivory);
		color: var(--ink);
		font-family: 'Jost', system-ui, sans-serif;
		font-weight: 300;
	}

	.hero {
		min-height: 72dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.3rem;
		text-align: center;
		padding: 5rem 1.5rem 4rem;
	}

	.eyebrow {
		margin: 0;
		font-family: 'Cinzel', serif;
		font-size: 0.68rem;
		letter-spacing: 0.5em;
		text-indent: 0.5em;
		text-transform: uppercase;
		color: var(--gold);
	}

	h1 {
		margin: 0;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-weight: 300;
		font-size: clamp(3rem, 10vw, 5.6rem);
		line-height: 1.05;
	}

	.script {
		margin: 0;
		font-family: 'Great Vibes', cursive;
		font-size: clamp(1.5rem, 5vw, 2rem);
		color: var(--gold);
	}

	.rule {
		margin: 0.5rem 0;
		width: min(18rem, 70%);
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--gold);
		font-size: 0.65rem;
	}

	.rule span {
		flex: 1;
		height: 1px;
		background: rgba(184, 150, 110, 0.4);
	}

	.lede {
		margin: 0;
		max-width: 30rem;
		line-height: 1.9;
		color: var(--taupe);
	}

	.line {
		display: grid;
		gap: 1.1rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		max-width: 68rem;
		margin: 0 auto;
		padding: 0 1.2rem;
	}

	.tpl {
		position: relative;
		aspect-ratio: 3 / 4;
		background-size: cover;
		background-position: center;
		display: grid;
		place-items: end stretch;
		overflow: hidden;
	}

	.tpl-veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(14, 10, 7, 0.78), rgba(14, 10, 7, 0.05) 55%);
	}

	.tpl-body {
		position: relative;
		color: #fdfbf8;
		padding: 1.5rem 1.4rem 1.6rem;
	}

	.tpl-body h2 {
		margin: 0 0 0.5rem;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-weight: 400;
		font-size: 1.65rem;
	}

	.tpl-body p {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.65;
		color: rgba(253, 251, 248, 0.82);
	}

	.features {
		display: grid;
		gap: 2.5rem 2rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		max-width: 62rem;
		margin: 0 auto;
		padding: 5rem 1.6rem 3rem;
		text-align: center;
	}

	.feature h3 {
		margin: 0 0 0.6rem;
		font-family: 'Cinzel', serif;
		font-weight: 500;
		font-size: 0.76rem;
		letter-spacing: 0.28em;
		text-indent: 0.28em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.feature p {
		margin: 0;
		font-size: 0.94rem;
		line-height: 1.8;
		color: var(--taupe);
	}

	footer {
		padding: 3rem 0 2.6rem;
		text-align: center;
	}

	.colophon {
		margin: 0;
		font-size: 0.62rem;
		letter-spacing: 0.4em;
		text-indent: 0.4em;
		text-transform: uppercase;
		color: rgba(143, 133, 119, 0.7);
	}
</style>
