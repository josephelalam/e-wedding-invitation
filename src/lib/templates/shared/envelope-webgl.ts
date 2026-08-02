/**
 * The envelope overture's optional WebGL renderer.
 *
 * This module is the lazy chunk: it is imported dynamically from
 * Envelope.svelte on the open gesture and must never be reachable from an
 * eager import, or three.js lands in every guest's bundle.
 *
 * Geometry is procedural — planes for the back/card/flap, one hand-built
 * triangle for the front pocket (see `triangle()` below) — no loader, no
 * asset fetch. That is a CSP requirement, not a preference: vite.config.ts
 * sets default-src 'self' with no worker-src override, so DRACO's blob
 * worker is blocked outright.
 */
import {
	AmbientLight,
	BufferGeometry,
	CanvasTexture,
	DirectionalLight,
	DoubleSide,
	Float32BufferAttribute,
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
// The card's peak zoom during the "fill" phase (see `apply()` below) — named
// and shared so the face texture can be sized for the *largest* the card
// ever renders at (see `composeCardFace`'s resolution comment) without that
// number drifting out of sync with the transform that actually applies it.
const CARD_FILL_SCALE = 1.35;
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
 * Loads an arbitrary photo URL into a real, decoded `<img>`.
 *
 * This exists because three.js's own `TextureLoader` hands the raw `<img>`
 * element straight to `texImage2D`, and browsers treat SVG sources as a
 * second-class citizen there: the `<img>` fires `load` (so a naive loader
 * reports success), but the subsequent GPU upload can still fail — observed
 * as a `texSubImage2D: bad image data` warning followed by the texture going
 * immutable/undefined, rendering as a solid broken-color block instead of
 * "no photo." `composeCardFace` below sidesteps that by never handing this
 * `<img>` to three.js directly: it goes through an offscreen 2D canvas
 * first, via `drawImage`, which accepts any decoded source (raster or
 * vector) uniformly — the canvas that results is a plain bitmap `texImage2D`
 * accepts everywhere.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			if (!img.naturalWidth || !img.naturalHeight) {
				reject(new Error(`photo has no intrinsic size: ${url}`));
				return;
			}
			resolve(img);
		};
		img.onerror = () => reject(new Error(`photo failed to load: ${url}`));
		img.src = url;
	});
}

/** `background-size: cover; background-position: center` for a 2D canvas. */
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
	const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
	const drawW = image.naturalWidth * scale;
	const drawH = image.naturalHeight * scale;
	ctx.drawImage(image, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
}

/** Greedy word wrap: fits `text` inside `maxWidth` at the context's current font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [text];
	const lines: string[] = [];
	let line = words[0];
	for (const word of words.slice(1)) {
		const candidate = `${line} ${word}`;
		if (ctx.measureText(candidate).width <= maxWidth) {
			line = candidate;
		} else {
			lines.push(line);
			line = word;
		}
	}
	lines.push(line);
	return lines;
}

/**
 * Ensures the concrete font faces this composition needs have their bytes in
 * hand before a single glyph is drawn.
 *
 * CSS text can silently repaint once a `@font-face` finishes downloading
 * (FOUT) — a canvas `fillText` cannot: whatever face is actually resolved at
 * the moment it runs is what gets baked into the texture forever, with no
 * second chance at a repaint. `document.fonts.load(font, text)` both fetches
 * the specific unicode-range subset fonts.css splits each family into
 * (passing the *real* text, not a placeholder, is what makes the browser
 * fetch the Arabic subset instead of the Latin one — see `composeCardFace`)
 * and resolves once ready. A hard timeout guards the case a subset never
 * arrives at all: better a slightly-late system-font texture than an upgrade
 * that never finishes because a font request stalled.
 */
async function ensureFontsReady(specs: { font: string; text: string }[]): Promise<void> {
	const loaded = Promise.allSettled(specs.map(({ font, text }) => document.fonts.load(font, text)));
	const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
	await Promise.race([loaded.then(() => undefined), timeout]);
}

type CardFaceOptions = {
	monogram: string;
	title: string;
	dir: 'ltr' | 'rtl';
	accent: string;
	paper: string;
	ink: string;
	monogramFont: string;
	titleFont: string;
	monogramSizePx: number;
	titleSizePx: number;
	titleLineHeightPx: number;
	gapPx: number;
	photo: string | null;
	cardWidth: number;
	cardHeight: number;
	scale: number;
};

/**
 * Composes the card's whole face — faint photo, monogram, couple's names —
 * onto one offscreen canvas, the same rasterize-everything-to-a-bitmap
 * approach `loadImage` above exists to feed: `texImage2D` accepts any canvas
 * regardless of what was drawn into it, so folding text into the same bitmap
 * costs nothing extra and can't reopen the SVG-upload bug a second time.
 *
 * Sized at `cardWidth`/`cardHeight` (Envelope.svelte's real, currently-
 * invisible CSS `.card` box, measured live) times `scale` (devicePixelRatio,
 * capped the same way the renderer caps it, times `CARD_FILL_SCALE` — the
 * card's own peak on-screen zoom), so the texture stays crisp even once the
 * card has scaled up to nearly fill the screen, not just at its resting
 * size. All drawing below happens in `cardWidth`/`cardHeight` units via one
 * `ctx.scale` up front, so it reads as plain CSS-pixel-of-the-card math.
 *
 * Never throws: any failure here (missing 2D context, a font that never
 * resolves, a photo that won't decode) must leave the card exactly as it was
 * before this feature existed — a plain paper-colored plane — rather than
 * take the whole scene down over a texture. The CSS envelope is the
 * fallback for a failed *upgrade*; a failed *texture* must not force that.
 */
async function composeCardFace(options: CardFaceOptions): Promise<HTMLCanvasElement | undefined> {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(options.cardWidth * options.scale));
		canvas.height = Math.max(1, Math.round(options.cardHeight * options.scale));
		const ctx = canvas.getContext('2d');
		if (!ctx) return undefined;
		ctx.scale(options.scale, options.scale);

		// Paper base — the same `--ei-bg` value `.card`'s own CSS background paints.
		ctx.fillStyle = options.paper;
		ctx.fillRect(0, 0, options.cardWidth, options.cardHeight);

		if (options.photo) {
			try {
				const image = await loadImage(options.photo);
				ctx.save();
				ctx.globalAlpha = 0.28; // matches `.card-photo`'s CSS opacity
				drawCover(ctx, image, options.cardWidth, options.cardHeight);
				ctx.restore();
			} catch {
				// No photo beats a corrupted one — same tradeoff `.card-photo`'s
				// `{#if photo}` guard makes: absence renders as plain paper.
			}
		}

		await ensureFontsReady([
			{ font: `400 ${options.monogramSizePx}px ${options.monogramFont}`, text: options.monogram },
			{ font: `400 ${options.titleSizePx}px ${options.titleFont}`, text: options.title }
		]);

		// `ctx.direction` is what makes `fillText` shape/order Arabic correctly —
		// the platform's own text shaper does the work, this just tells it which
		// way the line runs (mirrors the CSS card's inherited `dir` attribute).
		ctx.direction = options.dir;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const x = options.cardWidth / 2;

		// Mirrors `.card`'s CSS layout — a centered flex column, mark above
		// title, `gap` between — since a canvas has no flex box of its own to
		// do this for us. `monogramLineHeight` only needs to be approximate
		// (the monogram is always a short, single line); `titleLineHeightPx`
		// is measured from the live DOM instead, because it stacks per wrapped
		// line and drifting from the real CSS line-height would visibly bunch
		// or spread multi-line titles.
		const monogramLineHeight = options.monogramSizePx * 1.15;
		ctx.font = `400 ${options.titleSizePx}px ${options.titleFont}`;
		const titleLines = wrapLines(ctx, options.title, options.cardWidth * 0.92);
		const titleBlockHeight = titleLines.length * options.titleLineHeightPx;
		const blockHeight = monogramLineHeight + options.gapPx + titleBlockHeight;

		let y = (options.cardHeight - blockHeight) / 2 + monogramLineHeight / 2;
		ctx.font = `400 ${options.monogramSizePx}px ${options.monogramFont}`;
		ctx.fillStyle = options.accent;
		ctx.fillText(options.monogram, x, y);

		y += monogramLineHeight / 2 + options.gapPx + options.titleLineHeightPx / 2;
		ctx.font = `400 ${options.titleSizePx}px ${options.titleFont}`;
		ctx.fillStyle = options.ink;
		for (const line of titleLines) {
			ctx.fillText(line, x, y);
			y += options.titleLineHeightPx;
		}

		return canvas;
	} catch {
		return undefined;
	}
}

export async function mountEnvelope(
	canvas: HTMLCanvasElement,
	options: {
		accent: string;
		paper: string;
		ink: string;
		photo: string | null;
		monogram: string;
		title: string;
		dir: 'ltr' | 'rtl';
		monogramFont: string;
		titleFont: string;
		monogramSizePx: number;
		titleSizePx: number;
		titleLineHeightPx: number;
		gapPx: number;
		cardWidth: number;
		cardHeight: number;
	}
): Promise<EnvelopeScene> {
	// Capped the same way for the renderer's own framebuffer and the card
	// face's texture below, so "crisp" means the same thing in both places.
	const dpr = Math.min(window.devicePixelRatio, 2);
	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(dpr);
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
	const geometries: BufferGeometry[] = [];
	const plane = (w: number, h: number) => {
		const geometry = new PlaneGeometry(w, h);
		geometries.push(geometry);
		return geometry;
	};
	// A flat triangle in the group's local XY plane (z=0) — the three.js
	// analogue of a CSS clip-path triangle. PlaneGeometry can only ever emit a
	// rectangle, but the envelope's front pocket and side flaps are triangles
	// in the CSS reference (`.bottom`/`.side.left`/`.side.right`'s
	// `clip-path: polygon(...)`), so their geometry has to be built directly
	// from three vertices — no loader, no extra three.js module, needed for
	// that. Vertex order is counter-clockwise as seen from +z (same facing
	// every plane mesh in this scene gets from PlaneGeometry by default), so
	// `computeVertexNormals` derives (0,0,1) here too and lighting matches.
	const triangle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
		const geometry = new BufferGeometry();
		// prettier-ignore
		const positions = new Float32Array([
			ax, ay, 0,
			bx, by, 0,
			cx, cy, 0
		]);
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
		geometry.computeVertexNormals();
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
	try {
		const face = await composeCardFace({
			monogram: options.monogram,
			title: options.title,
			dir: options.dir,
			accent: options.accent,
			paper: options.paper,
			ink: options.ink,
			monogramFont: options.monogramFont,
			titleFont: options.titleFont,
			monogramSizePx: options.monogramSizePx,
			titleSizePx: options.titleSizePx,
			titleLineHeightPx: options.titleLineHeightPx,
			gapPx: options.gapPx,
			photo: options.photo,
			cardWidth: options.cardWidth,
			cardHeight: options.cardHeight,
			// Sized for the card's largest on-screen footprint (see
			// `composeCardFace`'s doc comment), not just its resting size.
			scale: dpr * (1 + CARD_FILL_SCALE)
		});
		if (face) {
			cardTexture = new CanvasTexture(face);
			cardTexture.colorSpace = SRGBColorSpace;
			cardMaterial.map = cardTexture;
		}
	} catch {
		// composeCardFace already fails soft internally; this belt-and-
		// suspenders catch covers the CanvasTexture construction itself, so a
		// texture failure can never take the rest of the scene down with it.
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

	// The front pocket: a triangle mirroring the CSS envelope's `.bottom`
	// (`clip-path: polygon(0 100%, 50% 50%, 100% 100%)`) over the *whole*
	// envelope box — apex at dead centre, base along the bottom edge — not a
	// bottom-anchored rectangle. The card's text block is centred, so a
	// rectangle tall enough to read as a pocket (the shape this replaces,
	// `plane(W, H * 0.62)`) necessarily reached above the envelope's centre
	// and covered it; this triangle's coverage shrinks to zero width at
	// y = 0, matching the sliver the CSS `.bottom` leaves.
	//
	// Its z is deliberately close to the card's own resting z (0.01), not far
	// in front of it: the CSS reference only gets away with a *flat* triangle
	// here because `.card` itself is never flat at rest — `apply()`'s resting
	// tilt physically pushes the card's lower half (where the title sits)
	// toward the camera by a few hundredths of a unit, past this triangle's
	// plane, the same way `.card`'s own `rotateX` pushes it past `.bottom`'s
	// z=0 in the browser (confirmed directly via `elementFromPoint` against
	// the live CSS card: `.bottom` never wins a hit test anywhere inside
	// `.card`'s own box at rest, only in the margin outside it). Sitting this
	// triangle at the old rectangle's 0.04 left no headroom for that tilt to
	// matter — the title lost the race by a hair regardless of which way the
	// tilt leaned. Close to 0.01, the tilt decides it the same way the
	// browser does.
	const front = new Mesh(triangle(-W / 2, -H / 2, W / 2, -H / 2, 0, 0), paper);
	front.position.z = 0.02;
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
		// Negative, not positive: three.js's Y axis points up, while the CSS
		// reference's local (pre-transform) axis for this same rotation points
		// down the page, so the *same-signed* angle tips the card the opposite
		// way in the two renderers unless negated here. Signed this way, the
		// card's lower half (negative local Y — where the title sits, see
		// `front`'s own comment above) tips toward the camera at rest, exactly
		// like the CSS card's lower half tips toward the guest under its own
		// `rotateX`. Get the sign wrong and the *upper* half (the monogram)
		// tips forward instead — the opposite of what the CSS reference does,
		// and the title loses its one path past `front`'s triangle at rest.
		card.rotation.x = -(1 - rise) * 0.14;
		// The flap, once fully open (a near-180° flip about its top-edge hinge),
		// comes to rest spatially overlapping the card's own risen position —
		// both end up occupying roughly the same world Y band above the
		// envelope's top edge. Z stayed level with the card's original resting
		// z (0.01, deliberately *behind* `front`'s 0.02 so the sealed envelope
		// still reads as "tucked in"), the now-legible title got painted over
		// by the flap for the back half of the rise phase — invisible before
		// this pass added any text to the card, since two blank shapes
		// overlapping reads as nothing in particular. Walking the card forward
		// in step with `rise` keeps it ahead of the flap's fixed post-open z by
		// the time their footprints actually overlap, without changing
		// anything about the sealed pose (rise = 0 leaves z untouched).
		card.position.z = 0.01 + rise * 0.3;
		const scale = 1 + fill * CARD_FILL_SCALE;
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
