<script lang="ts">
	// Ambient falling petals (edges template). Pure canvas, ~zero cost, and
	// fully absent for prefers-reduced-motion guests.
	let { color = '#d8b7a5' }: { color?: string } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const context = canvas.getContext('2d');
		if (!context) return;

		let width = (canvas.width = window.innerWidth);
		let height = (canvas.height = window.innerHeight);
		const COUNT = Math.min(16, Math.round(width / 60));
		const petals = Array.from({ length: COUNT }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size: 4 + Math.random() * 6,
			speedY: 0.35 + Math.random() * 0.6,
			driftPhase: Math.random() * Math.PI * 2,
			driftSpeed: 0.004 + Math.random() * 0.006,
			spin: Math.random() * Math.PI
		}));

		let frame = 0;
		const draw = () => {
			context.clearRect(0, 0, width, height);
			context.fillStyle = color;
			context.globalAlpha = 0.5;
			for (const petal of petals) {
				petal.driftPhase += petal.driftSpeed;
				petal.x += Math.sin(petal.driftPhase) * 0.6;
				petal.y += petal.speedY;
				petal.spin += 0.01;
				if (petal.y > height + 20) {
					petal.y = -20;
					petal.x = Math.random() * width;
				}
				context.save();
				context.translate(petal.x, petal.y);
				context.rotate(petal.spin);
				context.beginPath();
				context.ellipse(0, 0, petal.size, petal.size / 2.2, 0, 0, Math.PI * 2);
				context.fill();
				context.restore();
			}
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);

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

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 5;
	}
</style>
