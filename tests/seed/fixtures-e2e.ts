/** Shared constants between the e2e seeder and the Playwright specs. */
export const E2E = {
	slug: 'e2e-wedding',
	eventId: 'ev_e2e_1111111111',
	otherSlug: 'e2e-other',
	otherEventId: 'ev_e2e_2222222222',
	edgesSlug: 'e2e-edges',
	edgesEventId: 'ev_e2e_3333333333',
	cineSlug: 'e2e-cine',
	cineEventId: 'ev_e2e_4444444444',
	tokens: {
		guest: 'E2eGuestTok1111111111x',
		decline: 'E2eDeclineTok111111111',
		revoked: 'E2eRevokedTok111111111',
		other: 'E2eOtherTok11111111111',
		edges: 'E2eEdgesTok11111111111',
		cine: 'E2eCineTok111111111111'
	},
	owner: { email: 'e2e-owner@example.com', password: 'e2e-owner-passphrase-1', name: 'E2E Owner' },
	couple: { email: 'e2e-couple@example.com', name: 'Nour & Leo' }
};
