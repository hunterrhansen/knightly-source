-- 0012: coaching explanations for practice puzzles (puzzle_feedback.py): the punishing reply
-- and its reason for each wrong first move, and the solution's why, prepared by the worker
-- for the served puzzle. One replaceable, versioned value per user and puzzle.
CREATE TABLE puzzle_feedback (
    user_id     INTEGER NOT NULL DEFAULT app_user() REFERENCES users ON DELETE CASCADE,
    puzzle_id   TEXT NOT NULL,
    value       JSONB NOT NULL,
    PRIMARY KEY (user_id, puzzle_id)
);
ALTER TABLE puzzle_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON puzzle_feedback USING (user_id = app_user()) WITH CHECK (user_id = app_user());
