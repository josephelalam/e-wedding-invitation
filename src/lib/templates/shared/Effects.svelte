<script lang="ts">
	// Ambient particle layer, available to every template via the theme's
	// `effect` field. Pure canvas, pointer-transparent, and fully absent for
	// prefers-reduced-motion guests. Sparkles rise (the gold-dust convention);
	// everything else falls.
	export type EffectKind = 'petals' | 'hearts' | 'sparkles' | 'leaves' | 'snow';

	let { kind = 'petals', color = '#d8b7a5' }: { kind?: EffectKind; color?: string } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	const COUNTS: Record<EffectKind, number> = {
		petals: 16,
		hearts: 13,
		sparkles: 26,
		leaves: 12,
		snow: 28
	};

	$effect(() => {
		if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const context = canvas.getContext('2d');
		if (!context) return;

		let width = (canvas.width = window.innerWidth);
		let height = (canvas.height = window.innerHeight);
		const rises = kind === 'sparkles';
		const count = Math.min(COUNTS[kind], Math.max(8, Math.round(width / 55)));
		const fill = kind === 'snow' ? '#ffffff' : color;

		const make = () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size:
				kind === 'sparkles' || kind === 'snow' ? 1.2 + Math.random() * 2.6 : 4 + Math.random() * 6,
			speedY: (rises ? -1 : 1) * (kind === 'snow' ? 0.25 : 0.35) * (1 + Math.random() * 1.6),
			driftPhase: Math.random() * Math.PI * 2,
			driftSpeed: 0.004 + Math.random() * 0.006,
			spin: Math.random() * Math.PI,
			twinkle: Math.random() * Math.PI * 2
		});
		const particles = Array.from({ length: count }, make);

		const draw = () => {
			context.clearRect(0, 0, width, height);
			context.fillStyle = fill;
			for (const p of particles) {
				p.driftPhase += p.driftSpeed;
				p.x += Math.sin(p.driftPhase) * 0.6;
				p.y += p.speedY;
				p.spin += kind === 'leaves' ? 0.02 : 0.01;
				p.twinkle += 0.045;
				if (!rises && p.y > height + 20) {
					p.y = -20;
					p.x = Math.random() * width;
				}
				if (rises && p.y < -20) {
					p.y = height + 20;
					p.x = Math.random() * width;
				}
				context.save();
				context.translate(p.x, p.y);
				context.rotate(p.spin);
				context.beginPath();
				if (kind === 'petals') {
					context.globalAlpha = 0.5;
					context.ellipse(0, 0, p.size, p.size / 2.2, 0, 0, Math.PI * 2);
				} else if (kind === 'leaves') {
					context.globalAlpha = 0.45;
					context.ellipse(0, 0, p.size, p.size / 3.2, 0, 0, Math.PI * 2);
				} else if (kind === 'hearts') {
					context.globalAlpha = 0.5;
					const s = p.size * 0.8;
					context.arc(-s / 2, 0, s / 2, Math.PI, 0);
					context.arc(s / 2, 0, s / 2, Math.PI, 0);
					context.lineTo(0, s * 1.15);
					context.closePath();
				} else if (kind === 'sparkles') {
					// gold dust: soft pulse, occasional four-point glint
					context.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(p.twinkle));
					context.arc(0, 0, p.size, 0, Math.PI * 2);
				} else {
					context.globalAlpha = 0.75;
					context.arc(0, 0, p.size, 0, Math.PI * 2);
				}
				context.fill();
				context.restore();
			}
			frame = requestAnimationFrame(draw);
		};
		let frame = requestAnimationFrame(draw);

		const onResize = () => {
			if (!canvas) return;
			width = canvas.width = window.innerWidth;
			height = canvas.height = window.innerHeight;
		};
		window.addEventListener('resize', onResize);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<canvas class="fx" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 5;
	}
</style>
