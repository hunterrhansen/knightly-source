-- 0018: "Don't show this again" (review deck quality part 5,
-- docs/specs/2026-10-16-review-deck-quality-design.md). A suspended card is skipped
-- everywhere but keeps its FSRS state and review history, so showing it again resumes its
-- schedule; nothing is deleted (sync would re-create a deleted card). Additive, so the
-- previous image keeps working during a rollback.
ALTER TABLE cards ADD COLUMN suspended_at TEXT,  -- ISO-8601 UTC; NULL: in the deck
                  ADD COLUMN suspend_reason TEXT
                      CHECK (suspend_reason IN ('engine_wrong', 'not_useful', 'already_known'));
