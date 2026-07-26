import { test, expect } from '@playwright/test';
import { E2E } from '../seed/fixtures-e2e';

// The template module system: every layout serves the same contract —
// personalization, audio-unlock open button, and the shared RSVP pipeline.

test.describe('edges template (torn-paper story)', () => {
	test('renders the story, torn photo bands, and takes an RSVP', async ({ page }) => {
		await page.goto(`/e/${E2E.edgesSlug}/i/${E2E.tokens.edges}`);

		// personalized hero with the open gesture
		await expect(page.getByText('For Fadi & Nadine')).toBeVisible();
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// signature elements: torn photo bands + story texts
		await expect(page.locator('.band').first()).toBeVisible();
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
		await expect(page.getByText("Wonderful — we can't wait to see you!")).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.edges}`);
		expect(await state.json()).toMatchObject({ rsvp: { attending: true, confirmedSeats: 2 } });
	});
});

test.describe('cinematic template', () => {
	test('shows the loading curtain, then the hero, then sections', async ({ page }) => {
		await page.goto(`/e/${E2E.cineSlug}/i/${E2E.tokens.cine}`);

		// the curtain must always clear on its own — never trap a guest
		// (locally the placeholder photos load instantly, so it may already be gone)
		await expect(page.locator('.curtain')).toBeHidden({ timeout: 10_000 });

		await expect(page.getByText('For Sara')).toBeVisible();
		await page.getByRole('button', { name: 'Open Invitation' }).click();
		await expect(page.getByText('Two stories becoming one.')).toBeVisible();
		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		await expect(page.locator('[data-section="rsvp"]')).toBeVisible();
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
