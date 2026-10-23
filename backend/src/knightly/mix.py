"""What each item of a watch is for: the nightly watch's mix, slot by slot.

A watch is daily.GOAL items, and every one has a job (the core-20% audit: what moves a
400-1500 player). Two look before moving: a threat, allows, vision or calm question from your
own games (drill.py), because at this level games are decided by material given away. Four
drill tonight's idea: the current post's puzzles (wards.ward_puzzle), volume on one idea at a
time; a post taught from your own games (the Gatehouse) serves those drills first, then its
practice puzzles. Two are mixed review: an earlier post's idea served unannounced, or "Your move" with no
sign whether anything is there, because in a game nobody says "find the fork". Two come from
your games: a review card due tonight, or a fresh puzzle on the idea of one you just met.

The slots are spread so no kind comes twice running. A slot with nothing to serve falls
back to the next kind that has something, tonight's idea last, so a learner with no games
yet still gets a full watch of puzzles. Extra watches take the same mix (extra.py), so
continuing always feels like the same thing.
"""

from datetime import date

from . import deck, drill, extra, puzzles, unannounced, wards

LOOK, IDEA, GAMES, REVIEW = "look", "idea", "games", "review"
SLOTS = (LOOK, IDEA, GAMES, IDEA, REVIEW, LOOK, IDEA, GAMES, REVIEW, IDEA)
# When a slot has nothing, the others in this order; tonight's idea is the deepest supply.
FALLBACK = (GAMES, REVIEW, LOOK, IDEA)


def slot(n: int) -> str:
    """The job of a watch's item `n` (0-based), repeating for a longer watch."""
    return SLOTS[n % len(SLOTS)]


def serve(conn, today: date, n: int, asked: dict, moves: dict, remaining: list, *, extra_watch: bool) -> dict:
    """Item `n` of a watch: {card, threat, move, puzzle, mode}, at most one of the four set
    (all None when nothing at all can be served). `card` is a (game_id, ply) key; `mode` says
    why it was served (DeckOut.mode), None for a review card."""
    first = slot(n)
    for kind in (first, *(k for k in FALLBACK if k != first)):
        found = _kind(conn, today, kind, n, asked, moves, remaining, extra_watch)
        if found:
            return {"card": None, "threat": None, "move": None, "puzzle": None, "mode": None, **found}
    return {"card": None, "threat": None, "move": None, "puzzle": None, "mode": None}


def _kind(conn, today, kind, n, asked, moves, remaining, extra_watch) -> dict | None:
    if kind == LOOK:
        return _look(conn, asked)
    if kind == IDEA:
        return _idea(conn, today)
    if kind == GAMES:
        return _games(conn, today, remaining, extra_watch)
    # Mixed review alternates which of its two halves goes first, so both come up each watch.
    first, second = (_earlier, _your_move) if SLOTS[: n % len(SLOTS)].count(REVIEW) % 2 == 0 else (_your_move, _earlier)
    return first(conn, today, moves) or second(conn, today, moves)


def _look(conn, asked) -> dict | None:
    nxt = asked["next"]
    item = drill.item(conn, nxt["game_id"], nxt["ply"]) if nxt else None
    return {"threat": item, "mode": "defend"} if item else None


def _idea(conn, today) -> dict | None:
    # A post taught from the learner's own games (the Gatehouse's "take the loose piece")
    # serves those first; its practice puzzles only once they run out.
    if row := drill.post_item(conn, today, wards.current_drills(conn)):
        item = drill.item(conn, row["game_id"], row["ply"])
        if item:
            return {"threat": item, "mode": "defend"}
    puzzle = puzzles.idea_puzzle(conn, today)
    if puzzle is None:
        return None
    # The post's own idea is announced; a fallback theme (a post the corpus can't serve) is not.
    return {"puzzle": puzzle, "mode": "taught" if puzzle.pop("taught", False) else "volume"}


def _games(conn, today, remaining, extra_watch) -> dict | None:
    """A review card due tonight, the most likely forgotten first; then the family puzzle owed
    to a position first met tonight; then, in an extra watch, new slips and family puzzles for
    held moves. Cards due tonight that the nightly watch had no room for come first in an
    extra watch too: none was reviewed tonight, so it is no early second review."""
    if queued := deck.lesson_queue(conn, today=today, remaining=remaining):
        return {"card": (queued[0]["game_id"], queued[0]["ply"])}
    owed = puzzles.family_due(conn, today)
    if owed and (fam := puzzles.family_puzzle(conn, *owed, today)):
        return {"puzzle": {**fam, "family": {"game_id": owed[0], "ply": owed[1]}}, "mode": "volume"}
    if not extra_watch:
        return None
    if slip := extra.new_slip(conn):
        return {"card": slip}
    if held := extra.held_family(conn, today):
        return {"puzzle": held[1], "mode": "volume"}
    return None


def _earlier(conn, today, moves) -> dict | None:
    puzzle = wards.review_puzzle(conn, today)
    return {"puzzle": puzzle, "mode": "review"} if puzzle else None


def _your_move(conn, today, moves) -> dict | None:
    nxt = moves["next"]
    item = unannounced.item(conn, nxt["game_id"], nxt["ply"]) if nxt else None
    return {"move": item, "mode": "unannounced"} if item else None
