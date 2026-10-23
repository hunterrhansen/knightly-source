-- 0026: whether you took the chance (patterns.tag_chances). Until now this was read as
-- `uci = best_uci`, which is right for a tactic -- there is one move that wins the piece --
-- and wrong for a positional idea, where developing the bishop instead of the knight is
-- still developing. The idea is what we are counting, so the answer has to be stored rather
-- than inferred from the move.
-- Additive, and backfilled with the old rule so existing tactical rates are unchanged.
ALTER TABLE moves ADD COLUMN chance_found BOOLEAN;  -- NULL: not a chance, or not examined yet
UPDATE moves SET chance_found = (uci = best_uci)
  WHERE chance_motif IS NOT NULL AND best_uci IS NOT NULL;
