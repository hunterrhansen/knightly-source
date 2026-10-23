-- Drop the bot-play columns 0017 stopped reading and writing (bot games were removed then).
-- Nothing has used them since; 0017 kept them so a rollback past it still found them.
--
-- Not additive. Reverse (the values are gone, so they come back empty):
--   ALTER TABLE games ADD COLUMN bot_hints INTEGER, ADD COLUMN bot_takebacks INTEGER,
--     ADD COLUMN spotted_found INTEGER, ADD COLUMN spotted_asked INTEGER;
ALTER TABLE games
    DROP COLUMN bot_hints,
    DROP COLUMN bot_takebacks,
    DROP COLUMN spotted_found,
    DROP COLUMN spotted_asked;
