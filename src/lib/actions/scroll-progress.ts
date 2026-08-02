/**
 * Scroll progress as a CSS custom property.
 *
 * One rAF loop serves every registered element. Per frame it reads
 * `window.scrollY` once and then does nothing but arithmetic and
 * `style.setProperty` — element offsets, viewport height, and document
 * height are all cached at registration and refreshed only on resize, so
 * the loop never forces layout.
 *
 * The loop also parks itself once a frame produces no change (and whenever
 * `document.hidden`), instead of running at 60fps for the whole visit —
 * guests leave invitations open while music plays. `wake()` is wired to
 * `scroll`/`resize`/`visibilitychange`, so a parked loop resumes within a
 * frame of the next scroll.
 *
 * Choreography stays declarative in CSS. Every driven property must be
 * written `var(--p, X)` where X is the settled value, so a guest with no JS
 * (or `prefers-reduced-motion`) sees the element at rest with no second
 * code path — see the design spec §3.4.
 */
import type { Action } from 'svelte/action';

export type ProgressMode = 'view' | 'page' | 'sticky';

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** 0 when the top edge meets the viewport bottom, 1 when the bottom edge meets the viewport top. */
export function computeProgress(scrollY: number, vh: number, top: number, height: number): number {
	const range = height + vh;
	if (range <= 0) return 0;
	return clamp01((scrollY + vh - top) / range);
}

/** 0 at the top of the document, 1 at the bottom of the scrollable extent. */
export function pageProgress(scrollY: number, vh: number, docHeight: number): number {
	const range = docHeight - vh;
	if (range <= 0) return 0;
	return clamp01(scrollY / range);
}

/**
 * 'view' mode measures an element's transit *through* the viewport — right
 * for content that scrolls past. A `position: sticky` stage doesn't transit:
 * it pins at the viewport top and holds still while the guest scrolls its
 * own height away underneath. Modeling that with 'view' semantics reports
 * progress for a transit that never happens (an element pinned at the
 * document top reads ~0.33 progress at rest, well into its "settled" range),
 * so a stage with a sticky child needs this dedicated mode instead: 0 when
 * the stage's top reaches the viewport top, 1 when the sticky child unpins,
 * i.e. once scrollY has advanced by exactly the stage's own scrollable
 * range (height - vh).
 */
export function stickyProgress(scrollY: number, vh: number, top: number, height: number): number {
	const range = height - vh;
	if (range <= 0) return 0;
	return clamp01((scrollY - top) / range);
}

type Entry = {
	node: HTMLElement;
	mode: ProgressMode;
	top: number;
	height: number;
	// 'sticky' mode only: the pinned child's own rendered height. See
	// measureStickyHeight() for why this can't just be the cached global `vh`.
	stickyHeight: number;
	last: number;
	visible: boolean;
};

// 'sticky' mode's formula needs "the viewport height as experienced by the
// pinned child," which is only the same number as `window.innerHeight` if
// the child is sized with a unit that resolves to the same viewport metric.
// Envelope.svelte's sticky child is deliberately `100svh` (so the stage
// never resizes when a mobile toolbar shows/hides), but `window.innerHeight`
// tracks the *large* viewport on most mobile browsers — taller than the
// small viewport `svh` resolves to. Feeding that mismatch into stickyProgress
// makes the unpin point arrive before scrollY actually gets there, so `--p`
// hits 1 early and holds (the 0.75→1 fill range finishes before the card
// unpins). Measuring the pinned child directly sidesteps the viewport-unit
// mismatch instead of requiring every 'sticky'-mode caller to match units
// with `window.innerHeight`.
function measureStickyHeight(node: HTMLElement): number {
	for (const child of node.children) {
		if (getComputedStyle(child).position === 'sticky') return (child as HTMLElement).offsetHeight;
	}
	// No sticky child found (contract violation) — fall back to the node's
	// own height rather than throwing, matching this module's fail-soft style.
	return node.offsetHeight;
}

const entries = new Map<HTMLElement, Entry>();
let frame = 0;
let observer: IntersectionObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let listening = false;

// Viewport and document height, like element offsets, only change on
// resize or reflow — cache them so tick() never touches layout-forcing
// properties.
let vh = 0;
let docHeight = 0;

function measure(entry: Entry) {
	let top = 0;
	let node: HTMLElement | null = entry.node;
	while (node) {
		top += node.offsetTop;
		node = node.offsetParent as HTMLElement | null;
	}
	entry.top = top;
	entry.height = entry.node.offsetHeight;
	if (entry.mode === 'sticky') entry.stickyHeight = measureStickyHeight(entry.node);
}

function measureGlobals() {
	vh = window.innerHeight;
	docHeight = document.documentElement.scrollHeight;
}

function tick() {
	frame = 0;
	const scrollY = window.scrollY;
	let active = false;
	let changed = false;

	for (const entry of entries.values()) {
		if (!entry.visible) continue;
		active = true;
		const value =
			entry.mode === 'page'
				? pageProgress(scrollY, vh, docHeight)
				: entry.mode === 'sticky'
					? stickyProgress(scrollY, vh, entry.top, entry.height)
					: computeProgress(scrollY, vh, entry.top, entry.height);
		// Writing an identical value still invalidates style; skip the no-op.
		if (value !== entry.last) {
			entry.last = value;
			entry.node.style.setProperty('--p', value.toFixed(4));
			changed = true;
		}
	}

	// Park once a frame produces no change — a position:fixed entry is
	// always "active" (intersecting), so `active` alone would never park.
	if (active && changed && !document.hidden) frame = requestAnimationFrame(tick);
}

function wake() {
	if (frame || document.hidden) return;
	frame = requestAnimationFrame(tick);
}

function ensureGlobals() {
	if (listening) return;
	listening = true;

	observer = new IntersectionObserver((records) => {
		for (const record of records) {
			// The page-mode plane is position:fixed and always intersecting;
			// view- and sticky-mode entries are ordinary in-flow elements, so
			// they park the loop once they leave.
			const entry = entries.get(record.target as HTMLElement);
			if (entry) entry.visible = record.isIntersecting;
		}
		wake();
	});

	// document.documentElement's box grows with content reflow (image loads,
	// dynamic sections, fonts swapping in), not just window resizes, so this
	// one observer target keeps both offsets and docHeight/vh current.
	resizeObserver = new ResizeObserver(() => {
		for (const entry of entries.values()) measure(entry);
		measureGlobals();
		wake();
	});
	resizeObserver.observe(document.documentElement);

	window.addEventListener('scroll', wake, { passive: true });
	window.addEventListener(
		'resize',
		() => {
			// window.innerHeight can change without ResizeObserver firing (mobile
			// toolbar show/hide, on-screen keyboard, window resize without reflow).
			// Refresh vh here so tick() has current viewport height; docHeight
			// refreshes via ResizeObserver when content reflows.
			vh = window.innerHeight;
			wake();
		},
		{ passive: true }
	);
	document.addEventListener('visibilitychange', wake);
}

export const progress: Action<HTMLElement, ProgressMode | undefined> = (node, mode = 'view') => {
	// No JS-driven motion for reduced-motion guests: leaving --p unset makes
	// every `var(--p, X)` resolve to its settled value.
	if (typeof window === 'undefined') return {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
	if (typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined') {
		return {};
	}

	ensureGlobals();
	const entry: Entry = { node, mode, top: 0, height: 0, stickyHeight: 0, last: -1, visible: false };
	measure(entry);
	measureGlobals();
	entries.set(node, entry);
	observer?.observe(node);
	wake();

	return {
		destroy() {
			observer?.unobserve(node);
			entries.delete(node);
			node.style.removeProperty('--p');
		}
	};
};
