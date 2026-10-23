-- 0020: each analysed position's engine line, kept from the analysis that already computes it,
-- so game review's Best and Why open at once instead of running Stockfish per tap. Lichess
-- stores the same per ply (its Info.variation, at most 12 plies). Space-separated UCI;
-- best_line starts at the position before the move (its first move is best_uci), reply_line
-- at the position after it. NULL for games analysed before this, and where the game is over.
ALTER TABLE moves ADD COLUMN best_line TEXT;
ALTER TABLE moves ADD COLUMN reply_line TEXT;
