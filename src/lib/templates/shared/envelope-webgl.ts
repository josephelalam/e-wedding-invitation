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
	CanvasTexture,
	DirectionalLight,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	SRGBColorSpace,
	WebGLRenderer,
	type Texture
} from 'three';

export type EnvelopeScene = {
	setProgress(p: number): void;
	dispose(): void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const slice = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

// The envelope's own footprint (see `W`/`H` below) — kept as named constants
// up here too so `frameCamera` can size the shot around them without the two
// numbers drifting apart if one is ever tuned later.
const ENVELOPE_W = 3.6;
const ENVELOPE_H = 2.4;
const FOV_DEG = 38;
// Headroom around the sealed envelope so it sits centered with clear margin,
// echoing the CSS envelope's own `min(22rem, 82vw)` sizing (which likewise
// never lets the card fill the viewport edge-to-edge at rest).
const FRAME_MARGIN = 1.3;

/**
 * Places the camera so the sealed envelope (progress 0, before the "rise"/
 * "fill" phases deliberately scale the card past the frame) fits inside the
 * frustum on whichever axis binds first for the current canvas aspect.
 *
 * The bug this fixes: the camera used to sit at a hardcoded z with an aspect
 * plugged into its FOV but no corresponding adjustment to distance. On a
 * portrait phone (aspect ~0.46) the envelope's 3.6-unit width is nearly
 * double the ~2 units the frustum shows at that fixed distance, so every
 * plane — back, card, flap, front — overflowed the frame's left/right edges
 * and painted as full-width horizontal color bands instead of a recognizable
 * envelope. Recomputing distance from the actual aspect (called again on
 * resize below) keeps the whole shape inside the frame at any viewport size.
 */
function frameCamera(camera: PerspectiveCamera, canvas: HTMLCanvasElement) {
	const aspect = canvas.clientWidth / canvas.clientHeight || 1;
	camera.aspect = aspect;
	const halfFovRad = (FOV_DEG * Math.PI) / 360;
	const tanHalfFov = Math.tan(halfFovRad);
	const distanceForHeight = ENVELOPE_H / 2 / tanHalfFov;
	const distanceForWidth = ENVELOPE_W / 2 / (tanHalfFov * aspect);
	camera.position.z = Math.max(distanceForHeight, distanceForWidth) * FRAME_MARGIN;
	camera.updateProjectionMatrix();
}

/**
 * Loads the card's photo as a texture, tolerating any image the loader can't
 * actually turn into GPU-usable pixels.
 *
 * three.js's TextureLoader hands the raw `<img>` element straight to
 * `texImage2D`, and browsers treat SVG sources as a second-class citizen
 * there: the `<img>` fires `load` (so TextureLoader's success callback runs
 * and reports a "loaded" texture), but the subsequent GPU upload can still
 * fail — observed as a `texSubImage2D: bad image data` warning followed by
 * the texture going immutable/undefined, which then renders as a solid
 * broken-color block instead of "no photo." Routing every image through an
 * offscreen 2D canvas first sidesteps that: a canvas is always a fully
 * rasterized bitmap regardless of the source format, which is a source
 * `texImage2D` accepts everywhere. If even that fails (any load error, or a
 * source with no intrinsic size), the card keeps its plain paper color
 * instead of a corrupted texture.
 */
async function loadCardTexture(url: string): Promise<Texture | undefined> {
	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`card photo failed to load: ${url}`));
			img.src = url;
		});
		if (!image.naturalWidth || !image.naturalHeight) {
			throw new Error(`card photo has no intrinsic size: ${url}`);
		}
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const context2d = canvas.getContext('2d');
		if (!context2d) return undefined;
		context2d.drawImage(image, 0, 0);
		const texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		return texture;
	} catch {
		return undefined;
	}
}

export async function mountEnvelope(
	canvas: HTMLCanvasElement,
	options: { accent: string; paper: string; photo: string | null }
): Promise<EnvelopeScene> {
	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

	const scene = new Scene();
	const camera = new PerspectiveCamera(FOV_DEG, 1, 0.1, 100);
	frameCamera(camera, canvas);

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

	const W = ENVELOPE_W;
	const H = ENVELOPE_H;
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
		cardTexture = await loadCardTexture(options.photo);
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
		frameCamera(camera, canvas);
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
