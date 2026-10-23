-- 0023: a card's family (puzzles.family_puzzle,
-- docs/specs/2026-10-17-weakness-model-design.md step 5). A review card is one position, and
-- re-serving that one position teaches the diagram rather than the idea behind it. A family is
-- Lichess puzzles carrying the same tactic, served next to the card they match, so the idea is
-- what recurs. These columns say which card a puzzle was served for; NULL is an ordinary
-- session puzzle. Mastery then needs one family member solved, not just the stored position.
ALTER TABLE puzzle_attempts ADD COLUMN family_game_id INTEGER,
                            ADD COLUMN family_ply INTEGER;
CREATE INDEX puzzle_attempts_family ON puzzle_attempts (user_id, family_game_id, family_ply)
    WHERE family_game_id IS NOT NULL;
