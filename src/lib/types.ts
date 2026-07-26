/** Client-safe view of a card's current answer (mirrors RsvpRow server-side). */
export type RsvpView = {
	attending: boolean;
	confirmedSeats: number;
	note: string | null;
	updatedAt: string;
} | null;

export type LocalizedText = Partial<Record<'ar' | 'fr' | 'en', string>>;
export type ExtraDate = { label: LocalizedText; at: string };

/** Client-safe location shape rendered on the invitation. */
export type InviteLocation = {
	id: string;
	kind: string;
	labelEn: string | null;
	labelAr: string | null;
	labelFr: string | null;
	mapsUrl: string | null;
	startsAt: string | null;
	sort: number;
};
