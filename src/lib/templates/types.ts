import type { Lang } from '$lib/i18n';
import type { Theme } from '$lib/themes/schema';
import type { RsvpView, ExtraDate, InviteLocation } from '$lib/types';

/** The data contract every template renders from (guest page + studio preview). */
export type InviteData = {
	lang: Lang;
	languages: string[];
	event: {
		titleEn: string | null;
		titleAr: string | null;
		titleFr: string | null;
		dateMain: string;
		datesExtra: ExtraDate[];
	};
	theme: Theme;
	locations: InviteLocation[];
	invitation: { guestLabel: string; maxSeats: number };
	musicUrl: string | null;
	turnstileSiteKey: string | null;
};

/** Everything precomputed once by the dispatcher so templates stay presentational. */
export type TemplateCtx = {
	lang: Lang;
	dir: 'rtl' | 'ltr';
	title: string;
	dateFull: string;
	/** The engraved date block: WEEKDAY / MONTH DD / YYYY between hairline rules. */
	dateParts: { weekday: string; day: string; month: string; year: string };
	monogram: string;
	welcomeText: string | null;
	closingText: string;
	introText: string | null;
	parentsText: string | null;
	giftsText: string | null;
	endCaptionText: string | null;
	imageUrls: string[];
	/** Owner-placed background video (deck layouts); photos stay the fallback. */
	videoUrl: string | null;
	rsvpIsClosed: boolean;
};

export type TemplateProps = {
	data: InviteData;
	ctx: TemplateCtx;
	currentRsvp: RsvpView;
	errorKey: string | null;
	preview: boolean;
	opened: boolean;
	/** The cover/hero start button calls this — it is the audio-unlock gesture. */
	onopen: () => void;
};
