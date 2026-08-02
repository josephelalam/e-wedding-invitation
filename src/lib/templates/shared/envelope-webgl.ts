/**
 * The envelope overture's optional WebGL renderer.
 *
 * This module is the lazy chunk: it is imported dynamically from
 * Envelope.svelte on the open gesture and must never be reachable from an
 * eager import, or three.js lands in every guest's bundle.
 *
 * Geometry is procedural — six planes, no loader, no asset fetch. That is a
 * CSP requirement, not a preference: vite.config.ts sets default-src 'self'
 * with no worker-src override, so DRACO's blob worker is blocked outright.
 */
import {
	AmbientLight,
	DirectionalLight,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	SRGBColorSpace,
	TextureLoader,
	WebGLRenderer,
	type Texture
} from 'three';

export type EnvelopeScene = {
	setProgress(p: number): void;
	dispose(): void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const slice = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

export async function mountEnvelope(
	canvas: HTMLCanvasElement,
	options: { accent: string; paper: string; photo: string | null }
): Promise<EnvelopeScene> {
	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

	const scene = new Scene();
	const camera = new PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
	camera.position.set(0, 0, 6.2);

	scene.add(new AmbientLight(0xffffff, 1.1));
	const key = new DirectionalLight(0xffffff, 1.5);
	key.position.set(-2.5, 3.5, 4);
	scene.add(key);

	const paper = new MeshStandardMaterial({
		color: options.paper,
		roughness: 0.92,
		metalness: 0,
		side: DoubleSide
	});
	const lining = new MeshStandardMaterial({
		color: options.accent,
		roughness: 0.85,
		metalness: 0.05,
		side: DoubleSide
	});

	const W = 3.6;
	const H = 2.4;
	const geometries: PlaneGeometry[] = [];
	const plane = (w: number, h: number) => {
		const geometry = new PlaneGeometry(w, h);
		geometries.push(geometry);
		return geometry;
	};

	const group = new Group();
	scene.add(group);

	const back = new Mesh(plane(W, H), paper);
	back.position.z = -0.02;
	group.add(back);

	// The card: rises out of the envelope and scales to fill.
	let cardTexture: Texture | undefined;
	const cardMaterial = new MeshStandardMaterial({
		color: 0xffffff,
		roughness: 0.95,
		metalness: 0,
		side: DoubleSide
	});
	if (options.photo) {
		cardTexture = await new Promise<Texture | undefined>((resolve) => {
			new TextureLoader().load(
				options.photo as string,
				(texture) => {
					texture.colorSpace = SRGBColorSpace;
					resolve(texture);
				},
				undefined,
				() => resolve(undefined)
			);
		});
		if (cardTexture) cardMaterial.map = cardTexture;
	}
	const card = new Mesh(plane(W * 0.92, H * 0.88), cardMaterial);
	card.position.z = 0.01;
	group.add(card);

	// The flap: pivoted at its top edge, so the geometry is offset downward
	// inside a group whose rotation is the hinge.
	const flapHinge = new Group();
	flapHinge.position.set(0, H / 2, 0.03);
	const flap = new Mesh(plane(W, H / 2), lining);
	flap.position.y = -H / 4;
	flapHinge.add(flap);
	group.add(flapHinge);

	const front = new Mesh(plane(W, H * 0.62), paper);
	front.position.set(0, -H * 0.19, 0.04);
	group.add(front);

	let raf = 0;
	let progress = 0;
	let disposed = false;

	function apply() {
		const open = slice(progress, 0, 0.35);
		const rise = slice(progress, 0.35, 0.75);
		const fill = slice(progress, 0.75, 1);

		flapHinge.rotation.x = open * (-170 * (Math.PI / 180));
		card.position.y = rise * H * 0.62;
		card.rotation.x = (1 - rise) * 0.14;
		const scale = 1 + fill * 1.35;
		card.scale.set(scale, scale, 1);
		cardMaterial.opacity = 1;
		group.rotation.x = (1 - open) * 0.06;
	}

	function render() {
		raf = 0;
		if (disposed) return;
		apply();
		renderer.render(scene, camera);
	}

	function schedule() {
		if (raf || disposed) return;
		raf = requestAnimationFrame(render);
	}

	const onResize = () => {
		if (disposed) return;
		renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
		schedule();
	};
	window.addEventListener('resize', onResize, { passive: true });

	schedule();

	return {
		setProgress(value: number) {
			progress = clamp01(value);
			schedule();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			for (const geometry of geometries) geometry.dispose();
			paper.dispose();
			lining.dispose();
			cardMaterial.dispose();
			cardTexture?.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}
