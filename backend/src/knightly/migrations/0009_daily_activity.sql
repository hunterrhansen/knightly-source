-- 0009: the daily review's history (daily.py). One row per user-local day on which the
-- user did something or Today showed a plan: which of the three steps were completed, and
-- how many steps the plan had. Streaks are computed from these rows, so they don't depend
-- on later edits elsewhere (finishing a game again moves game_reviews.reviewed_at forward).
CREATE TABLE daily_activity (
    user_id     INTEGER NOT NULL DEFAULT app_user() REFERENCES users ON DELETE CASCADE,
    day         TEXT NOT NULL,                 -- YYYY-MM-DD in the user's time zone
    planned     INTEGER,                       -- steps Today offered; NULL: never shown that day
    game        INTEGER NOT NULL DEFAULT 0,    -- 1: reviewed a game
    positions   INTEGER NOT NULL DEFAULT 0,    -- 1: answered every position due
    puzzles     INTEGER NOT NULL DEFAULT 0,    -- 1: finished the day's puzzle session
    updated_at  TEXT NOT NULL DEFAULT iso_now(),
    PRIMARY KEY (user_id, day)
);
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON daily_activity USING (user_id = app_user()) WITH CHECK (user_id = app_user());
