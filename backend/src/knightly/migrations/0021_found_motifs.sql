-- 0021: tactics you found (patterns.tag_found,
-- docs/specs/2026-10-17-weakness-model-design.md step 1). The counterpart of `pattern`, which
-- names the tactic behind a mistake: this names the tactic a sound move of yours carried out,
-- so a motif's successes and failures can be counted against each other. Without it only
-- failures are stored, and how often a tactic was taken has to be recomputed from every FEN.
-- NULL: not examined yet; 'other': examined, no tactic of yours here.
ALTER TABLE moves ADD COLUMN found_motif TEXT;
CREATE INDEX moves_user_found_motif ON moves (user_id, found_motif) WHERE found_motif IS NOT NULL;
