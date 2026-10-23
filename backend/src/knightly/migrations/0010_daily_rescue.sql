-- 0010: "Save my streak" (daily.py): 1 when the day's short rescue session was finished, which
-- keeps the streak like a finished step does.
ALTER TABLE daily_activity ADD COLUMN rescue INTEGER NOT NULL DEFAULT 0;
