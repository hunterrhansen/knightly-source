-- Which search made a threat question's accepted answers (drill.ANSWER_SET).
--
-- 1: the opponent's top 3 lines for 'threat' and 'calm' items, and only the engine's single
-- refutation for 'allows' items, so a reply that also won material was graded wrong.
-- 2: their top 5 lines, and every winning reply for 'allows'. Existing rows start at 1 and
-- `drill.widen` searches them again a batch per update run.
--
-- Additive. Reverse: ALTER TABLE threat_cards DROP COLUMN answer_set;
ALTER TABLE threat_cards ADD COLUMN answer_set smallint NOT NULL DEFAULT 1;
