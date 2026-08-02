import { test, expect, type Page } from '@playwright/test';
import { E2E } from '../seed/fixtures-e2e';

// The template module system: every layout serves the same contract —
// personalization, audio-unlock open button, and the shared RSVP pipeline.

test.describe('edges template (torn-paper story)', () => {
	test('renders the story, torn photo bands, and takes an RSVP', async ({ page }) => {
		await page.goto(`/e/${E2E.edgesSlug}/i/${E2E.tokens.edges}`);

		// personalized hero with the open gesture
		await expect(page.getByText('For Fadi & Nadine')).toBeVisible();
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// signature elements: torn photo bands + story texts + ambient effect
		await expect(page.locator('.band').first()).toBeVisible();
		await expect(page.locator('canvas.fx')).toBeAttached();
		await expect(page.getByText('let no one separate', { exact: false })).toBeVisible();
		await expect(page.getByText('Mr. & Mrs. Karam', { exact: false })).toBeVisible();
		await expect(page.getByText('Wedding list: 03 123 456', { exact: false })).toBeVisible();
		await expect(page.getByText('And so the adventure begins…')).toBeVisible();

		// the shared RSVP pipeline works inside this template too
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		const changeAnswer = page.getByRole('button', { name: 'You can change your answer' });
		if (await changeAnswer.isVisible().catch(() => false)) await changeAnswer.click();
		await page.getByText('Yes, with joy').click();
		await page.locator('input[name="seats"]').fill('2');
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText("Wonderful! We can't wait to see you.")).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.edges}`);
		expect(await state.json()).toMatchObject({ rsvp: { attending: true, confirmedSeats: 2 } });
	});
});

test.describe('cinematic template (Horizon — horizontal deck)', () => {
	test('cover gate opens into a horizontal scroll-snap deck of scenes', async ({ page }) => {
		await page.goto(`/e/${E2E.cineSlug}/i/${E2E.tokens.cine}`);

		// the cover gate: personalized, one button, deck locked behind it
		await expect(page.getByText('For Sara')).toBeVisible();
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// signature: a horizontal track of full-screen scenes with a dot rail
		await expect(page.getByText('Two stories becoming one.')).toBeVisible();
		const scenes = page.locator('.track .scene');
		expect(await scenes.count()).toBeGreaterThanOrEqual(4);
		const dots = page.locator('.dots button');
		expect(await dots.count()).toBe(await scenes.count());

		// the getting-ready scene (groom's + bride's houses) always precedes the
		// ceremony scene, even though the fixture stores the ceremony first
		const locationScenes = page.locator('.scene[data-section="locations"]');
		await expect(locationScenes.nth(0)).toContainText('Cine Groom Home');
		await expect(locationScenes.nth(0)).toContainText('Cine Bride Home');
		await expect(locationScenes.nth(1)).toContainText('Cine Cathedral');

		// the gifts scene carries the engraved account with its copy button
		const gifts = page.locator('.scene[data-section="gifts"]');
		await expect(gifts).toContainText('81 234 567');
		await expect(gifts.getByRole('button', { name: 'Copy number' })).toBeAttached();

		// the moving swipe caption is chrome at the bottom of the deck
		await expect(page.locator('.hint')).toBeAttached();

		// the track scrolls sideways, not down
		const overflow = await page.locator('.track').evaluate((el) => getComputedStyle(el).overflowX);
		expect(overflow).toBe('auto');

		// horizontal navigation reaches the RSVP scene
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		await expect(page.locator('[data-section="rsvp"]')).toBeVisible();
	});
});

test.describe('depth template (parallax story)', () => {
	test('cover opens into a continuous parallax scroll and takes an RSVP', async ({ page }) => {
		await page.goto(`/e/${E2E.depthSlug}/i/${E2E.tokens.depth}`);

		await expect(page.getByText('For Rami & Lea')).toBeVisible();
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// signature: a fixed photo plane behind the column, plus photo bands
		await expect(page.locator('.photo-plane')).toBeVisible();
		await expect(page.locator('.band').first()).toBeVisible();
		await expect(page.getByText('Scroll gently — the day unfolds as you go.')).toBeVisible();

		// the engine is driving: --p is set on the photo plane once scrolled
		await page.mouse.wheel(0, 1200);
		await expect
			.poll(async () =>
				page.locator('.photo-plane').evaluate((el) => el.style.getPropertyValue('--p'))
			)
			.not.toBe('');

		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		const changeAnswer = page.getByRole('button', { name: 'You can change your answer' });
		if (await changeAnswer.isVisible().catch(() => false)) await changeAnswer.click();
		await page.getByText('Yes, with joy').click();
		await page.locator('input[name="seats"]').fill('2');
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText("Wonderful! We can't wait to see you.")).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.depth}`);
		expect(await state.json()).toMatchObject({ rsvp: { attending: true, confirmedSeats: 2 } });
	});
});

test.describe('overture template (the envelope)', () => {
	test('the sealed envelope gates the story, then scrubs open', async ({ page }) => {
		await page.goto(`/e/${E2E.overtureSlug}/i/${E2E.tokens.overture}`);

		// sealed: the envelope is present and the stage is locked to one screen
		await expect(page.locator('.stage.sealed')).toBeVisible();
		await expect(page.locator('.env .flap')).toBeVisible();
		await expect(page.getByText('For Ziad')).toBeVisible();

		await page.getByRole('button', { name: 'Open Invitation' }).click();
		await expect(page.locator('.stage.sealed')).toHaveCount(0);

		// The envelope itself is scroll-scrubbed (`.stage` uses 'sticky' mode,
		// see scroll-progress.ts), not just gated by the tap. Read its own --p
		// rather than trusting DOM presence: once `.overture.locked` is gone,
		// ScrollBody's whole content becomes unclipped normal-flow content, so
		// the toBeVisible()/toBeAttached() checks further down would keep
		// passing even if the scrub engine were deleted outright — they prove
		// presence, not motion.
		const stage = page.locator('.stage');
		const stageP = () => stage.evaluate((el) => Number(el.style.getPropertyValue('--p') || 0));

		// At rest, right after the tap, --p must already read ~0. id="slide-0"
		// lives on this stage rather than on ScrollBody's first section (see
		// ScrollBody's `ownsSlideAnchor` prop) precisely so the dispatcher's
		// post-open scrollIntoView lands here instead of sweeping through the
		// envelope — a skipped anchor would land scroll further down and this
		// would read high instead of ~0. A stage stuck in 'view' mode would
		// also read high here at rest, settling around 0.33 (see
		// stickyProgress's doc comment in scroll-progress.ts).
		await expect.poll(stageP).toBeLessThan(0.05);

		// Now prove --p tracks the scroll itself, not just the tap: nudge in
		// bounded steps rather than one big jump. The stage's whole scrubbable
		// range is about one viewport tall, so a single large wheel delta (as
		// this test used to do) can clear the entire range in one step,
		// leaving only a before/after sample — which can't tell a real
		// scroll-driven engine from one that merely reaches 1 some other way
		// (e.g. a fixed-duration reveal timed to elapsed time instead of
		// scroll position). Sampling the climb is what proves the
		// relationship between scroll input and --p.
		let sawMidpoint = false;
		let last = 0;
		for (let i = 0; i < 15 && last < 1; i++) {
			await page.mouse.wheel(0, 150);
			await page.waitForTimeout(100); // let scroll-progress.ts's rAF loop catch up
			const p = await stageP();
			expect(p, `--p went backwards at step ${i}: ${last} -> ${p}`).toBeGreaterThanOrEqual(last);
			if (p > 0.3 && p < 0.95) sawMidpoint = true;
			last = p;
		}
		expect(sawMidpoint, '--p never passed through the middle of its scrub range').toBe(true);
		expect(last, '--p never reached the end of its scrub range').toBe(1);

		// scrubbing the envelope all the way open also reveals the parallax
		// body underneath it
		await expect(page.getByText('The envelope is yours to open.')).toBeVisible();
		// gifts is further down the scroll body — not scrolled to yet, so only
		// its presence in the DOM is the claim here, not on-screen visibility
		await expect(page.getByText('70 987 654')).toBeAttached();

		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		const changeAnswer = page.getByRole('button', { name: 'You can change your answer' });
		if (await changeAnswer.isVisible().catch(() => false)) await changeAnswer.click();
		await page.getByText('Yes, with joy').click();
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText("Wonderful! We can't wait to see you.")).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.overture}`);
		expect(await state.json()).toMatchObject({ rsvp: { attending: true } });
	});
});

test.describe('scroll templates degrade safely', () => {
	test('reduced-motion guests see every section already settled', async ({ page }) => {
		// Deliberately not `test.use({ reducedMotion: 'reduce' })`: in this
		// Playwright/Chromium combination that context option is silently a
		// no-op — verified directly (even on about:blank, matchMedia reports
		// prefers-reduced-motion: false with the context option set). The
		// explicit runtime call below is confirmed to actually flip the media
		// feature, so it's the only reliable way to drive this scenario here.
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto(`/e/${E2E.depthSlug}/i/${E2E.tokens.depth}`);
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// the engine never registers under prefers-reduced-motion (scroll-progress.ts
		// returns early before ever touching the node), so no inline style is ever
		// written and --p stays permanently unset; every var(--p, X) rests at its
		// settled value. Checking the computed custom property directly is the more
		// direct claim than style.cssText (which would also happen to be '' if some
		// unrelated inline style were merely never assigned — this instead asserts
		// the specific engine-output property was never produced).
		await expect
			.poll(() =>
				page
					.locator('.photo-plane')
					.evaluate((el) => getComputedStyle(el).getPropertyValue('--p').trim())
			)
			.toBe('');
		const hero = page.getByText('Scroll gently — the day unfolds as you go.');
		await hero.scrollIntoViewIfNeeded();
		await expect(hero).toBeVisible();

		// Re-check after a real scroll happened (scrollIntoViewIfNeeded above
		// does move the page), not just at registration time: this rules out
		// the engine having wired up its scroll listener anyway and merely
		// deferring its first write, which the first poll above — taken before
		// any scroll occurred — could not distinguish from a genuine bail.
		await expect
			.poll(() =>
				page
					.locator('.photo-plane')
					.evaluate((el) => getComputedStyle(el).getPropertyValue('--p').trim())
			)
			.toBe('');
	});
});

test.describe('scroll templates without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	// Every layout's cover/envelope lock is SSR-immediate (class:locked={!opened},
	// present from the first byte) so a no-JS guest — who can never fire `onopen`
	// — needs the <noscript><style> override in each Template.svelte to free the
	// body. A guest with no JS also has no way to run scrollIntoView()/fetch — the
	// only mechanism they have to reach content below the fold is the browser's own
	// native scroll (wheel/touch/keyboard), which does nothing inside an
	// `overflow: hidden` box. toBeVisible() alone does not catch a still-locked
	// regression here: an element clipped by an ancestor's `overflow: hidden` still
	// reports a non-empty bounding box and passes Playwright's visibility check
	// (verified empirically against this exact layout shape — clipping is not part
	// of that algorithm). So each case here also drives a real wheel-scroll gesture
	// and asserts the RSVP section's bounding box actually moves into the viewport
	// — proof the guest can reach it natively, not just that it exists unclipped
	// somewhere off-screen.
	async function assertReachableByNativeScroll(page: Page) {
		const rsvp = page.locator('[data-section="rsvp"]');
		// Decorative on its own — toBeVisible() doesn't check clipping (see the
		// block comment above), so this alone proves nothing about reachability.
		// It's the nudge-and-recheck loop below that actually establishes it.
		await expect(rsvp).toBeVisible();
		const viewport = page.viewportSize();
		if (!viewport) throw new Error('no viewport size for this project');
		await page.mouse.move(viewport.width / 2, viewport.height / 2);
		// Real rect-vs-viewport intersection on both axes: cinematic's deck only
		// ever moves along x (y sits at 0 throughout), the rest only ever move
		// along y, so checking a single axis passes trivially for whichever
		// template doesn't move on that axis — this checks the one that matters
		// for either shape.
		const inViewport = (box: { x: number; y: number; width: number; height: number }) =>
			box.x < viewport.width &&
			box.x + box.width > 0 &&
			box.y < viewport.height &&
			box.y + box.height > 0;
		// Nudge and re-check in a plain bounded loop, rather than one giant jump
		// followed by polling a position that never changes again — a single
		// huge scroll reliably overshoots straight past the target (verified:
		// every template here overshot past the section on a 20000px jump), so
		// re-reading that same missed position forever would never resolve.
		// A plain loop (not expect.poll, whose exponential backoff between
		// retries stacks up over the ~16 steps the widest deck needs and blows
		// through even a generous timeout) drives this in well under a second.
		let reached = false;
		for (let i = 0; i < 60 && !reached; i++) {
			const box = await rsvp.boundingBox();
			if (box && inViewport(box)) reached = true;
			else {
				await page.mouse.wheel(0, 500);
				await page.mouse.wheel(500, 0); // cinematic's deck scrolls sideways
			}
		}
		const finalBox = await rsvp.boundingBox();
		expect(finalBox).toBeTruthy();
		expect(inViewport(finalBox!)).toBe(true);
	}

	test('slides renders its full content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.slug}/i/${E2E.tokens.guest}`);
		await expect(page.getByText('We would love to celebrate with you.')).toBeVisible();
		await assertReachableByNativeScroll(page);
	});

	test('edges renders its full content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.edgesSlug}/i/${E2E.tokens.edges}`);
		await expect(page.getByText('let no one separate', { exact: false })).toBeVisible();
		await assertReachableByNativeScroll(page);
	});

	test('cinematic renders its full content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.cineSlug}/i/${E2E.tokens.cine}`);
		await expect(page.getByText('Two stories becoming one.')).toBeVisible();
		await assertReachableByNativeScroll(page);
	});

	test('depth renders its full content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.depthSlug}/i/${E2E.tokens.depth}`);
		await expect(page.getByText('Scroll gently — the day unfolds as you go.')).toBeVisible();
		await assertReachableByNativeScroll(page);
	});

	test('overture renders its card content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.overtureSlug}/i/${E2E.tokens.overture}`);
		await expect(page.getByText('Olivia & Victor').first()).toBeVisible();
		await expect(page.getByText('The envelope is yours to open.')).toBeVisible();
		await assertReachableByNativeScroll(page);
	});
});

test.describe('template media serving', () => {
	test('theme/ images stream from R2, backups stay blocked', async ({ request }) => {
		const image = await request.get('/api/media/theme/e2e/1.svg');
		expect(image.status()).toBe(200);
		expect(image.headers()['content-type']).toContain('image/svg');
		const blocked = await request.get('/api/media/backups/2026-01-01/events.jsonl');
		expect(blocked.status()).toBe(404);
	});
});
