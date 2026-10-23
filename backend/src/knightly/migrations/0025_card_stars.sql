-- 0025: a card's star (docs/specs/2026-10-18-watch-story-design.md, "Stars and ranks"): when
-- it first reached long-term memory (deck.is_mastered). Set once and never cleared, so the
-- star count never falls when a card lapses. watch.stamp_stars sets it from the card's history
-- (the first answer whose stability_after reached deck.MASTERED_DAYS, or the family puzzle
-- that completed it), which also backfills cards mastered before this column existed.
-- Additive, so the previous image keeps working during a rollback.
ALTER TABLE cards ADD COLUMN mastered_at TEXT;  -- ISO-8601 UTC; NULL: no star yet
