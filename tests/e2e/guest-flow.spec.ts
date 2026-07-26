import { test, expect } from '@playwright/test';
import { E2E } from '../seed/fixtures-e2e';

// Spec §4.14 scenario ①: token link → cover → start button (audio playback
// state asserted) → swipe slides → RSVP → answer persists.

test.describe('guest flow', () => {
	test('cover opens with music, slides swipe, RSVP yes(2) persists', async ({ page }) => {
		await page.goto(`/e/${E2E.slug}/i/${E2E.tokens.guest}`);

		// The envelope: personalized cover, no audio yet (hard constraint #2)
		await expect(page.getByText('For Sami & Dana')).toBeVisible();
		const openButton = page.getByRole('button', { name: 'Open Invitation' });
		await expect(openButton).toBeVisible();
		const audio = page.locator('audio');
		await expect(audio).toHaveJSProperty('paused', true);

		// The button IS the audio unlock gesture
		await openButton.click();
		await expect(audio).toHaveJSProperty('paused', false);
		await expect(openButton).toBeHidden();

		// Persistent control: mute toggle present on slides, audio keeps playing across swipes
		const muteButton = page.getByRole('button', { name: 'Mute music' });
		await expect(muteButton).toBeVisible();

		for (const section of ['hero', 'countdown', 'locations', 'schedule', 'rsvp', 'closing']) {
			await page.locator(`[data-section="${section}"]`).scrollIntoViewIfNeeded();
			await expect(page.locator(`[data-section="${section}"]`)).toBeVisible();
		}
		await expect(audio).toHaveJSProperty('paused', false);

		// Mute toggle flips the element state without stopping playback
		await muteButton.click();
		await expect(audio).toHaveJSProperty('muted', true);
		await page.getByRole('button', { name: 'Play music' }).click();
		await expect(audio).toHaveJSProperty('muted', false);

		// Locations render as plain Google Maps links (no embeds, spec §8)
		const mapsLinks = page.getByRole('link', { name: /Open in Google Maps/ });
		await expect(mapsLinks).toHaveCount(2);

		// RSVP: yes with 2 seats
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		await page.getByText('Yes, with joy').click();
		await page.getByRole('button', { name: '+' }).click();
		await expect(page.locator('input[name="seats"]')).toHaveValue('2');
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText("Wonderful — we can't wait to see you!")).toBeVisible();

		// Answer round-trips through the API (cached HTML never bakes state)
		await page.reload();
		await page.getByRole('button', { name: 'Open Invitation' }).click();
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		await expect(page.getByText("Wonderful — we can't wait to see you!")).toBeVisible();
		await expect(page.locator('[data-section="rsvp"]')).toContainText('2');
	});

	test('declining guest is recorded with zero seats', async ({ page }) => {
		await page.goto(`/e/${E2E.slug}/i/${E2E.tokens.decline}`);
		await page.getByRole('button', { name: 'Open Invitation' }).click();
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		await page.getByText("We can't make it").click();
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText('Thank you for letting us know')).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.decline}`);
		expect(await state.json()).toMatchObject({
			rsvp: { attending: false, confirmedSeats: 0 }
		});
	});

	test('page stays silent but fully usable when audio cannot play', async ({ page }) => {
		// Block the media route: play() rejects, the invitation must still open.
		await page.route('**/api/media/**', (route) => route.abort());
		await page.goto(`/e/${E2E.slug}/i/${E2E.tokens.guest}`);
		await page.getByRole('button', { name: 'Open Invitation' }).click();
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		await expect(page.locator('[data-section="rsvp"]')).toBeVisible();
	});
});

test.describe('invalid links', () => {
	test('unknown token shows the graceful page', async ({ page }) => {
		await page.goto(`/e/${E2E.slug}/i/NotARealToken`);
		await expect(page.getByText('Invitation not found')).toBeVisible();
	});

	test('revoked card shows the graceful page, and its RSVP API is closed', async ({ page }) => {
		await page.goto(`/e/${E2E.slug}/i/${E2E.tokens.revoked}`);
		await expect(page.getByText('Invitation not found')).toBeVisible();
		const res = await page.request.get(`/api/rsvp/${E2E.tokens.revoked}`);
		expect(res.status()).toBe(404);
	});

	test('token from another event does not open this event', async ({ page }) => {
		await page.goto(`/e/${E2E.slug}/i/${E2E.tokens.other}`);
		await expect(page.getByText('Invitation not found')).toBeVisible();
	});
});
