-- Deepest layer of the seat-ceiling defence (spec §5): the form and the
-- service validate first; this trigger makes over-allowance rows impossible
-- even for a future code path that forgets to check.
CREATE TRIGGER rsvp_seats_max_insert BEFORE INSERT ON rsvps
WHEN NEW.confirmed_seats > (SELECT max_seats FROM invitations WHERE id = NEW.invitation_id)
BEGIN
	SELECT RAISE(ABORT, 'seats_exceed_allowance');
END;
--> statement-breakpoint
CREATE TRIGGER rsvp_seats_max_update BEFORE UPDATE ON rsvps
WHEN NEW.confirmed_seats > (SELECT max_seats FROM invitations WHERE id = NEW.invitation_id)
BEGIN
	SELECT RAISE(ABORT, 'seats_exceed_allowance');
END;
