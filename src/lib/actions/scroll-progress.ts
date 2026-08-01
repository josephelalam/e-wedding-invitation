/**
 * Scroll progress as a CSS custom property.
 *
 * One rAF loop serves every registered element. Per frame it reads
 * `window.scrollY` once and then does nothing but arithmetic and
 * `style.setProperty` — element offsets are cached at registration and
 * refreshed only on resize, so the loop never forces layout.
 *
 * Choreography stays declarative in CSS. Every driven property must be
 * written `var(--p, X)` where X is the settled value, so a guest with no JS
 * (or `prefers-reduced-motion`) sees the element at rest with no second
 * code path — see the design spec §3.4.
 */
import type { Action } from 'svelte/action';

export type ProgressMode = 'view' | 'page';

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

type Entry = {
	node: HTMLElement;
	mode: ProgressMode;
	top: number;
	height: number;
	last: number;
	visible: boolean;
};

const entries = new Set<Entry>();
let frame = 0;
let observer: IntersectionObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let listening = false;

function measure(entry: Entry) {
	let top = 0;
	let node: HTMLElement | null = entry.node;
	while (node) {
		top += node.offsetTop;
		node = node.offsetParent as HTMLElement | null;
	}
	entry.top = top;
	entry.height = entry.node.offsetHeight;
}

function tick() {
	frame = 0;
	const scrollY = window.scrollY;
	const vh = window.innerHeight;
	const docHeight = document.documentElement.scrollHeight;
	let active = false;

	for (const entry of entries) {
		if (!entry.visible) continue;
		active = true;
		const value =
			entry.mode === 'page'
				? pageProgress(scrollY, vh, docHeight)
				: computeProgress(scrollY, vh, entry.top, entry.height);
		// Writing an identical value still invalidates style; skip the no-op.
		if (value !== entry.last) {
			entry.last = value;
			entry.node.style.setProperty('--p', value.toFixed(4));
		}
	}

	if (active && !document.hidden) frame = requestAnimationFrame(tick);
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
			for (const entry of entries) {
				if (entry.node !== record.target) continue;
				// The page-mode plane is position:fixed and always intersecting;
				// view-mode entries park the loop once they leave.
				entry.visible = record.isIntersecting;
			}
		}
		wake();
	});

	resizeObserver = new ResizeObserver(() => {
		for (const entry of entries) measure(entry);
		wake();
	});
	resizeObserver.observe(document.documentElement);

	window.addEventListener('scroll', wake, { passive: true });
	window.addEventListener('resize', wake, { passive: true });
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
	const entry: Entry = { node, mode, top: 0, height: 0, last: -1, visible: false };
	measure(entry);
	entries.add(entry);
	observer?.observe(node);
	wake();

	return {
		destroy() {
			observer?.unobserve(node);
			entries.delete(entry);
			node.style.removeProperty('--p');
		}
	};
};
