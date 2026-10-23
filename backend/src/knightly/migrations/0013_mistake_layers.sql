-- 0013: mistake layers (layers.py, docs/specs/2026-10-16-safety-habit-training-design.md): which
-- habit or skill each of your game mistakes, misses and blunders came from, whether it was made
-- in time trouble, and the engine facts behind it (the opponent's threats before the move and
-- the refutation after it), kept so explanations can be written later without searching again.
-- NULL layer: not settled yet; 'other': settled, no layer holds; 'unknown': a search was capped.
ALTER TABLE moves ADD COLUMN layer TEXT,
                  ADD COLUMN time_trouble BOOLEAN,
                  ADD COLUMN cause_facts JSONB;
