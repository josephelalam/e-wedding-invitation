import { test, expect, type Page } from '@playwright/test';
import { E2E } from '../seed/fixtures-e2e';

// Spec §4.14 scenarios ④⑤⑥⑦: owner lifecycle, couple magic-link login,
// CSV export integrity, and the cross-tenant 403.

async function ownerSignIn(page: Page) {
	await page.goto('/studio/login');
	await page.getByLabel('Email').fill(E2E.owner.email);
	await page.getByLabel('Password').fill(E2E.owner.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
}

test.describe('owner lifecycle', () => {
	test('sign in → create event → import guests → links generated → go live → guest page opens', async ({
		page
	}) => {
		await ownerSignIn(page);

		// Create (slug unique per run+project so re-runs never hit slug_taken)
		const slug = `pw-${test.info().project.name === 'chromium' ? 'c' : 'w'}-${Date.now().toString(36)}`;
		await page.getByLabel('Link name (kebab-case)').fill(slug);
		await page.getByLabel('Title (English)').fill('Play & Wright');
		await page.getByLabel('Main date & time').fill('2027-10-09T17:00');
		await page.getByRole('button', { name: 'Create event' }).click();
		await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible();

		// Import guests (quoted commas + Arabic + an invalid row that must be skipped)
		await page.getByRole('link', { name: 'Guests' }).click();
		await page
			.getByLabel('Paste lines or CSV')
			.fill('"Karam, Elie & Maya",3,+9613123456,fr\nجاد وريتا,2,,ar\nBadRow\nSami,1');
		await page.getByRole('button', { name: 'Import' }).click();
		await expect(page.getByText('3 cards created.')).toBeVisible();
		await expect(page.getByText('Skipped: line 3')).toBeVisible();
		const cardsTable = page.locator('.st-table');
		await expect(cardsTable.getByText('Karam, Elie & Maya')).toBeVisible();
		await expect(cardsTable.getByText('جاد وريتا')).toBeVisible();
		await expect(page.getByRole('heading', { name: /^Cards \(3\)$/ })).toBeVisible();

		// Go live
		await page.getByRole('link', { name: 'Details' }).click();
		await page.getByRole('button', { name: 'Go live' }).click();
		await expect(page.getByText('Saved.')).toBeVisible();

		// A generated link opens the cover
		await page.getByRole('link', { name: 'Guests' }).click();
		await page.getByRole('button', { name: 'QR' }).first().click();
		const url = await page.locator('.qr-cell code').textContent();
		expect(url).toContain(`/e/${slug}/i/`);
		// The card was imported with lang=fr → the per-invitation override
		// must render the whole page in French (spec §8)
		await page.goto(url!);
		await expect(page.getByRole('button', { name: "Ouvrir l'invitation" })).toBeVisible();
		await expect(page.getByText('Pour Karam, Elie & Maya')).toBeVisible();
	});
});

test.describe('couple magic-link login + dashboard + export', () => {
	test('owner issues link via outbox; couple sees live stats; export matches; cross-tenant 403', async ({
		page,
		browser
	}) => {
		// Guest answers first so the dashboard has a known state
		const rsvp = await page.request.post(`/api/rsvp/${E2E.tokens.guest}`, {
			data: { attending: true, seats: 2, note: 'e2e yes' }
		});
		expect(rsvp.ok()).toBeTruthy();

		await ownerSignIn(page);
		await page.goto(`/studio/events/${E2E.eventId}/guests`);
		await page.getByLabel('Couple email').fill(E2E.couple.email);
		await page.getByRole('button', { name: 'Create sign-in link' }).click();
		await expect(page.getByText('waiting in the Outbox')).toBeVisible();

		await page.goto('/studio/outbox');
		const magicUrl = await page
			.locator('td', { hasText: 'http' })
			.locator('code')
			.first()
			.textContent();
		expect(magicUrl).toContain('/api/auth/magic-link/verify');

		// Couple opens the link in a fresh browser (their phone)
		const coupleContext = await browser.newContext();
		const couplePage = await coupleContext.newPage();
		await couplePage.goto(magicUrl!);
		await couplePage.waitForURL(`**/dash/${E2E.eventId}**`);
		await expect(couplePage.getByText('Nour & Leo').first()).toBeVisible();
		await expect(couplePage.getByText('Sami & Dana')).toBeVisible();

		// Export through the couple session matches the DB state
		const exportRes = await couplePage.request.get(`/api/events/${E2E.eventId}/export.csv`);
		expect(exportRes.status()).toBe(200);
		const csv = await exportRes.text();
		expect(csv).toContain('guest_label,max_seats,status');
		expect(csv).toContain('Sami & Dana,2,confirmed,2,e2e yes');

		// Tenant isolation: the couple must NOT reach the other event (spec §7.2)
		const crossExport = await couplePage.request.get(`/api/events/${E2E.otherEventId}/export.csv`);
		expect(crossExport.status()).toBe(403);
		const crossDash = await couplePage.request.get(`/dash/${E2E.otherEventId}`);
		expect(crossDash.status()).toBe(403);

		await coupleContext.close();
	});
});
