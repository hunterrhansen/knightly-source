# Games library

Approved direction: a native library that is just the list of games; Today's daily
review recommends what to review, so Games has no "next review" card. Preserve
Knightly's dark colors, Fredoka headings and Nunito text.
Use the existing navigation header/account action; do not duplicate the native title.
Proposed: a summary card, Slipped/Clean scopes and slip-state row status in
[The watch story](2026-10-18-watch-story-design.md#games).

## Layout and navigation

A game row opens the existing `/review/[gameId]` route; the review feature still
validates the recording and owns replay/lesson eligibility. Do not invent coach
summaries, moment counts, time estimates or completion. The API still returns
`next_review`; the screen does not show it.

Rows follow an iOS plain list (like Contacts): a 40 pt result badge (W filled
green, L red letter, D muted), the opponent with rating, one detail line (result,
speed, time) and a trailing status: REVIEW, ✓ with accuracy, or Replay while
analysis is pending. Separators start after the badge; date groups are quiet
section titles over a full-width line. Rows are about 60 pt; the opening and full
metadata stay in the row's accessible label.

The screen: opponent/opening search, Filters, All / To review / Reviewed, a quiet
import status and linked-account action, then local-day groups titled Today,
Yesterday, the weekday for 2–6 days ago ("Sunday"), then the date ("October 1",
with the year when it differs).
Web uses the same decreasing-lines filter icon as iOS, with an active count and
an accessible Filters label.
The web search field includes a decorative magnifying glass with space reserved
before the input text; its accessible label remains Search opponents or openings.
When editable search text is present, Clear search empties it and returns focus
to the input. The button disappears when the field is empty.
Search reserves its focus-border width while idle so placeholder/text positions
stay unchanged when focus moves into the field.
Each entire row opens review/replay and shows labeled result, opponent/rating,
opening, speed/time control/color, accuracy when known and saved review status.
Unknown metadata is omitted or labeled unavailable, never shown as zero.
Load older games appends a server page. Refresh and page failures retain rows.
Navigation back retains search/filters and the mounted library's scroll position.

iOS uses SwiftUI search, segmented/menu picker and a native sheet with menu
pickers. Large text switches the review scope to a menu; text and rows grow.
Web/Android use the same workflow with owned accessible inputs, scope choices and
filter dialog. Web presents a centered, rounded dialog using the Games theme,
with white/dark filter cards, disclosure arrows, a scrollable choice area and
persistent Cancel/Apply/Reset actions. The modal preserves the calling screen's
theme even in isolated previews. Android retains the existing sheet workflow.
Clicking the web backdrop discards the draft just like Cancel; clicking within
the dialog keeps it open.
The review toggle fills the content width with equal segments;
first/last game-row interaction highlights follow the group's rounded corners.
Dividers sit between rows so focus borders meet them without an inset gap.
All colors/fonts come from existing theme tokens. Native PostScript
font names match the already embedded Nunito and Fredoka fonts.

## Filters and data

Filters edit draft speed, result, color, period and learning focus. Apply commits
the draft and restarts paging; Cancel/swipe dismissal discards it. Reset changes
only the draft. Active filter chips are individually removable. Search is
debounced; requests and caches remain isolated by account/session and filter scope.
Progress deep links preserve their rated-game scope, period, opening and KPI;
normal library browsing/search includes unrated games. Clear filters returns to
the full library.

`GET /api/games` documents its existing row metadata and adds `review_status`,
`review_counts` and `next_review`. Review counts/recommendation use the complete
filtered collection before pagination/status selection, not the loaded page.
To review means analyzed + known player side + no saved review timestamp, across
all dates; this replaces the legacy seven-day cutoff. Reviewed requires the saved
server timestamp. The old quick-filter counts remain compatible, while
`review_counts` follows all applied search/result/KPI filters. No schema migration.

Validated infinite pages participate in the existing bounded account cache.
Legacy cached rows may lack richer metadata and recommendation/counts; omit those
values until refresh. A review save or changed import invalidates all Games reads.

## Recovery and verification

Unlinked: Connect Chess.com. Importing: real counts with existing rows usable.
No matches: clear search/filters. No pending reviews: You're caught up and View
all games. Loading/refresh/page errors offer truthful progress and retry actions.
The component gallery provides isolated narrow and state
previews; fixtures do not read or write account data.

Verify server counts/recommendation across pages, all-time eligibility, filter
composition and user isolation; client draft cancellation, query scope, paging,
cache restore, and server-acknowledged completion refresh. Inspect browser and iOS
search/picker/sheet, large text and review return. Spoken VoiceOver
and physical-device behavior remain manual checks in [status](../status.md).

The updated backend and client ship together; cached legacy metadata is only an
interim display while the current server refreshes it.
