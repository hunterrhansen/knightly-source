-- Forcing lines for multi-move practice (practice_lines.py), next to the grade map: one
-- replaceable, versioned value per move, inheriting moves' ownership, RLS and cascade.
ALTER TABLE moves ADD COLUMN practice_line JSONB;
-- What a graded answer submitted: the whole move list, and the line it was attempting.
ALTER TABLE card_reviews ADD COLUMN moves TEXT, ADD COLUMN line_key TEXT;
