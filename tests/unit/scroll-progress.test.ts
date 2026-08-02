import { describe, it, expect } from 'vitest';
import {
	computeProgress,
	pageProgress,
	stickyProgress
} from '../../src/lib/actions/scroll-progress';

// p = 0 when the element's top edge meets the viewport bottom,
// p = 1 when its bottom edge meets the viewport top.
describe('computeProgress (view mode)', () => {
	const vh = 800;

	it('is 0 before the element enters the viewport', () => {
		expect(computeProgress(0, vh, 2000, 400)).toBe(0);
	});

	it('is 0 exactly as the top edge touches the viewport bottom', () => {
		expect(computeProgress(1200, vh, 2000, 400)).toBe(0);
	});

	it('is 1 exactly as the bottom edge touches the viewport top', () => {
		expect(computeProgress(2400, vh, 2000, 400)).toBe(1);
	});

	it('is 0.5 at the midpoint of the transit', () => {
		expect(computeProgress(1800, vh, 2000, 400)).toBeCloseTo(0.5, 5);
	});

	it('clamps above 1 once the element is fully past', () => {
		expect(computeProgress(9999, vh, 2000, 400)).toBe(1);
	});

	it('handles an element taller than the viewport', () => {
		// transit range = height + vh = 2400
		expect(computeProgress(1200, vh, 2000, 1600)).toBe(0);
		expect(computeProgress(3600, vh, 2000, 1600)).toBe(1);
		expect(computeProgress(2400, vh, 2000, 1600)).toBeCloseTo(0.5, 5);
	});

	it('returns 0 for a degenerate zero range rather than dividing by zero', () => {
		expect(computeProgress(500, 0, 0, 0)).toBe(0);
	});
});

describe('pageProgress', () => {
	it('is 0 at the top of the document', () => {
		expect(pageProgress(0, 800, 3200)).toBe(0);
	});

	it('is 1 at the bottom of the document', () => {
		expect(pageProgress(2400, 800, 3200)).toBe(1);
	});

	it('is 0.5 halfway down the scrollable extent', () => {
		expect(pageProgress(1200, 800, 3200)).toBeCloseTo(0.5, 5);
	});

	it('returns 0 when the document is not scrollable', () => {
		expect(pageProgress(0, 800, 800)).toBe(0);
	});
});

// p = 0 when the stage's top edge meets the viewport top, p = 1 when the
// sticky child unpins (the stage has scrolled by its own height minus the
// viewport, height - vh). Mirrors Envelope.svelte's real geometry: a 200svh
// stage with a 100svh sticky child, i.e. height = 2 * vh.
describe('stickyProgress (sticky mode)', () => {
	const vh = 800;
	const height = 1600; // 2 * vh, matching the envelope's 200svh stage

	it('is 0 at the top of the document', () => {
		expect(stickyProgress(0, vh, 0, height)).toBe(0);
	});

	it('is 1 exactly at the unpin point', () => {
		// unpin when scrollY - top === height - vh === 800
		expect(stickyProgress(800, vh, 0, height)).toBe(1);
	});

	it('is 0.5 at the midpoint of the pinned transit', () => {
		expect(stickyProgress(400, vh, 0, height)).toBeCloseTo(0.5, 5);
	});

	it('clamps at 1 once scrolled past the unpin point', () => {
		expect(stickyProgress(9999, vh, 0, height)).toBe(1);
	});

	it('clamps at 0 before the stage top reaches the viewport top', () => {
		expect(stickyProgress(0, vh, 200, height)).toBe(0);
	});

	it('accounts for a non-zero top offset', () => {
		// stage starts 200px down the document; same 800px transit range
		expect(stickyProgress(1000, vh, 200, height)).toBeCloseTo(1, 5);
		expect(stickyProgress(600, vh, 200, height)).toBeCloseTo(0.5, 5);
	});

	it('returns 0 for a stage no taller than the viewport rather than dividing by zero', () => {
		expect(stickyProgress(500, vh, 0, 800)).toBe(0); // exactly vh
		expect(stickyProgress(500, vh, 0, 600)).toBe(0); // shorter than vh
	});
});
