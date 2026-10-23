-- Spot the threat answers in a game against the bot (docs/specs/2026-10-16-safety-habit-training-design.md):
-- how many of the "What does their move threaten?" questions you answered right, of those asked.
-- NULL for imported games and bot games played without Spot the threat.
ALTER TABLE games ADD COLUMN spotted_found INTEGER, ADD COLUMN spotted_asked INTEGER;
