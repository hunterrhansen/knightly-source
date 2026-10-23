-- Help used in games against the bot, shown with the game in review.
-- NULL for imported games; counts are per saved game.
ALTER TABLE games ADD COLUMN bot_hints INTEGER, ADD COLUMN bot_takebacks INTEGER;
