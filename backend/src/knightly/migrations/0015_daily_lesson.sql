-- 0015: the daily lesson (daily.py): 1 when the day's GOAL practice items were answered, which
-- keeps the streak (as does a reviewed game). Days before it count as they did then: any
-- finished step or "Save my streak". `rescue` stays for rollback and is no longer written.
ALTER TABLE daily_activity ADD COLUMN goal INTEGER NOT NULL DEFAULT 0;
UPDATE daily_activity SET goal = greatest(positions, puzzles, rescue);
