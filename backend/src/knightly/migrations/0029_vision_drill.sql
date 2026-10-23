-- Ward 1's drill: "they left a piece loose -- take it."
--
-- The first ward (board vision, attacking and defending, the profitable exchange) had no
-- drills at all, because Lichess tags puzzles by tactic and "is this piece defended?" is not
-- a tactic. It reported `blocked` and every learner started at ward 2. These items come from
-- the learner's own games by verified geometry, not from a tag.
--
-- Additive: one more value in the kind check. Reverse below; delete 'vision' rows first.
--   ALTER TABLE threat_cards DROP CONSTRAINT threat_cards_kind_check;
--   ALTER TABLE threat_cards ADD CONSTRAINT threat_cards_kind_check
--       CHECK (kind IN ('threat', 'calm', 'skip', 'allows'));
ALTER TABLE threat_cards DROP CONSTRAINT threat_cards_kind_check;
ALTER TABLE threat_cards ADD CONSTRAINT threat_cards_kind_check
    CHECK (kind IN ('threat', 'calm', 'skip', 'allows', 'vision'));
