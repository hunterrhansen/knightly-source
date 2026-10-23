-- "What does your move allow?": the second half of the checks-captures-threats thread.
--
-- The threat drill asks what the opponent threatens *before* you move. Nothing asked what
-- your own move hands them, which is the other half of the habit and the commoner error:
-- `layers.py` has tagged those moves `theirReply` ("your move allowed a short, forcing
-- reply") since the safety-habit work, and nothing ever served them as a question.
--
-- Additive: one more value in the kind check. Rolling back needs the reverse statement
-- below, and any 'allows' rows deleted first.
--   ALTER TABLE threat_cards DROP CONSTRAINT threat_cards_kind_check;
--   ALTER TABLE threat_cards ADD CONSTRAINT threat_cards_kind_check
--       CHECK (kind IN ('threat', 'calm', 'skip'));
ALTER TABLE threat_cards DROP CONSTRAINT threat_cards_kind_check;
ALTER TABLE threat_cards ADD CONSTRAINT threat_cards_kind_check
    CHECK (kind IN ('threat', 'calm', 'skip', 'allows'));
