-- 0027: the public profile behind a handle (players.py): the avatar a game's opponent shows
-- on Chess.com, with their title and country. Games carry only a username, and Chess.com's
-- game JSON has no avatar, so the worker fetches /pub/player/{handle} once per handle and
-- keeps it here. `missing` is the negative cache: most opponents have no avatar, and without
-- it they would be re-fetched on every run. Per user, like accounts: it holds only the
-- handles that user has played.
CREATE TABLE players (
    user_id      INTEGER NOT NULL DEFAULT app_user() REFERENCES users ON DELETE CASCADE,
    source       TEXT NOT NULL,                 -- chesscom | lichess | otb, as games.source
    handle       TEXT NOT NULL,                 -- lowercased, as sources.chesscom writes it
    avatar_url   TEXT,                          -- NULL when the player has no avatar
    display_name TEXT,
    title        TEXT,                          -- GM, IM, ... when they hold one
    country      TEXT,                          -- the API's country URL's last segment
    missing      BOOLEAN NOT NULL DEFAULT FALSE,-- the profile 404ed: don't ask again this cycle
    fetched_at   TEXT NOT NULL DEFAULT iso_now(),
    PRIMARY KEY (user_id, source, handle)
);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON players USING (user_id = app_user()) WITH CHECK (user_id = app_user());
