-- 0022: tactic chances (patterns.tag_chances,
-- docs/specs/2026-10-17-weakness-model-design.md step 1), replacing 0021's `found_motif`.
--
-- 0021 stored the tactic a move of yours *carried out*, which could only be counted against
-- `pattern`'s mistake tags -- and those are tagged by a different rule, so the numerator and
-- the denominator of a motif's rate disagreed. This stores the tactic the *best* move carried,
-- on every move where one move was clearly it. Whether you took the chance is then
-- `uci = best_uci`, so finds and misses come from one definition.
--
-- NULL: not examined yet; 'other': examined, no clear tactical chance here.
-- 0021's column is dropped rather than migrated: nothing read it and it re-tags in seconds.
ALTER TABLE moves DROP COLUMN found_motif,
                  ADD COLUMN chance_motif TEXT;
CREATE INDEX moves_user_chance_motif ON moves (user_id, chance_motif) WHERE chance_motif IS NOT NULL;
