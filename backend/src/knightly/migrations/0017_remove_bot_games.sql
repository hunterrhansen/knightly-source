-- Bot play was removed (2026-10-15): delete every user's games against the bot, which the
-- app saved with source 'bot'. Their analysis, moves, engine lines, cards, reviews and
-- threat questions go with them (ON DELETE CASCADE). The bot_hints, bot_takebacks,
-- spotted_found and spotted_asked columns are no longer read or written; they are dropped
-- in a later release so the previous image still works during a rollback (docs/deploy.md).
DELETE FROM games WHERE source = 'bot';
