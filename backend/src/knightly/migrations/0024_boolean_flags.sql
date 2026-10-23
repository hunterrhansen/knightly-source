-- 0024: yes/no columns become boolean. They were 0/1 integers because Knightly started on
-- SQLite, which has no boolean type. NULL stays NULL (moves.is_user: owner unknown).
--
-- Not additive: an image from before this migration compares these columns with 1 and
-- writes integers into them, so it fails against the new types. Take a fresh production
-- dump before deploying; to roll the image back, first run the reverse at the end.
ALTER TABLE games ALTER COLUMN rated TYPE boolean USING rated <> 0;

ALTER TABLE puzzle_attempts ALTER COLUMN success TYPE boolean USING success <> 0;

ALTER TABLE moves ALTER COLUMN is_user TYPE boolean USING is_user <> 0;

ALTER TABLE card_reviews
    ALTER COLUMN correct TYPE boolean USING correct <> 0,
    ALTER COLUMN solved DROP DEFAULT,
    ALTER COLUMN solved TYPE boolean USING solved <> 0,
    ALTER COLUMN solved SET DEFAULT false;

ALTER TABLE daily_activity
    ALTER COLUMN game DROP DEFAULT,
    ALTER COLUMN game TYPE boolean USING game <> 0,
    ALTER COLUMN game SET DEFAULT false,
    ALTER COLUMN positions DROP DEFAULT,
    ALTER COLUMN positions TYPE boolean USING positions <> 0,
    ALTER COLUMN positions SET DEFAULT false,
    ALTER COLUMN puzzles DROP DEFAULT,
    ALTER COLUMN puzzles TYPE boolean USING puzzles <> 0,
    ALTER COLUMN puzzles SET DEFAULT false,
    ALTER COLUMN rescue DROP DEFAULT,
    ALTER COLUMN rescue TYPE boolean USING rescue <> 0,
    ALTER COLUMN rescue SET DEFAULT false,
    ALTER COLUMN goal DROP DEFAULT,
    ALTER COLUMN goal TYPE boolean USING goal <> 0,
    ALTER COLUMN goal SET DEFAULT false;

-- Reverse, before rolling the image back (then DELETE FROM schema_migrations WHERE version = '0024'):
--   ALTER TABLE games ALTER COLUMN rated TYPE integer USING rated::int;
--   ALTER TABLE puzzle_attempts ALTER COLUMN success TYPE integer USING success::int;
--   ALTER TABLE moves ALTER COLUMN is_user TYPE smallint USING is_user::int;
--   ALTER TABLE card_reviews ALTER COLUMN correct TYPE integer USING correct::int,
--       ALTER COLUMN solved DROP DEFAULT, ALTER COLUMN solved TYPE integer USING solved::int,
--       ALTER COLUMN solved SET DEFAULT 0;
--   ALTER TABLE daily_activity  -- and likewise for positions, puzzles, rescue and goal
--       ALTER COLUMN game DROP DEFAULT, ALTER COLUMN game TYPE integer USING game::int,
--       ALTER COLUMN game SET DEFAULT 0;
