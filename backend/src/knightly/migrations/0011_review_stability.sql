-- 0011: how well a card was remembered before and after each graded answer (FSRS stability,
-- in days), so the daily review can say which positions reached long-term memory today
-- (deck.MASTERED_DAYS). Older reviews have neither and never count as newly mastered.
ALTER TABLE card_reviews ADD COLUMN stability_before DOUBLE PRECISION,
                         ADD COLUMN stability_after DOUBLE PRECISION;
