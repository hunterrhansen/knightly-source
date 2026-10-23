# Documentation

Start with [README](../README.md) and [agent instructions](../AGENTS.md).

| Document | Purpose |
| --- | --- |
| [Backend setup](../backend/README.md) | API, worker, local tests and contract export |
| [Backend instructions](../backend/AGENTS.md) | Backend ownership and isolation |
| [Claude Code entry](../CLAUDE.md) | Imports the agent instructions for Claude Code |
| [Deployment](deploy.md) | Preserved hosting, migration handoff and rollback |
| [Oracle infrastructure](../infra/oracle/README.md) | VM provisioning and state ownership |
| [Cloudflare infrastructure](../infra/cloudflare/README.md) | Tunnels, DNS and backup bucket |
| [Architecture](../ARCHITECTURE.md) | Source ownership and enforced import rules |
| [Requirements](universal-rebuild-requirements.md) | Product/platform scope and switch-over criteria |
| [Technology decisions](technology-decisions.md) | Accepted choices and explicit deferrals |
| [Board specification](specs/2026-10-10-universal-chessboard-design.md) | Approved board contract and behavior |
| [Layered board renderer](specs/2026-10-15-layered-board-design.md) | Lichess-style native renderer, the only native piece renderer since stage 4: one piece atlas, UI-thread motion |
| [Foundation specification](specs/2026-10-10-app-foundation-design.md) | Approved auth, shell and session behavior |
| [Daily practice design](specs/2026-10-11-daily-practice-design.md) | Implemented real-session contract, multi-move lines, puzzles, progression and save recovery |
| [Game review](specs/2026-10-11-game-review-design.md) | Real replay, guided lesson, engine explanations and completion recovery |
| [Line exploration](specs/2026-10-22-line-exploration-design.md) | Side lines in review (merged) evaluated by on-device Stockfish 19 Lite: web worker deployed, iOS/Android Expo module implemented; GPL obligations |
| [Coaching explanations](specs/2026-10-15-coaching-explanations-design.md) | Engine-backed reasons for wrong first moves (reply played first) and a why for solutions |
| [Safety-habit training](specs/2026-10-16-safety-habit-training-design.md) | Approved "what do they threaten?" drill and mistakes tagged by skill layer in review and Progress |
| [Blunder causes](specs/2026-10-16-blunder-causes-design.md) | Why you missed it (missed threat, back rank, loose piece), top-3 candidate moves and principle labels; practice and review's Every move |
| [Learning loop](specs/2026-10-17-learning-loop-design.md) | Proposed: mistake rates in your recent games against the games before, next to practice; lesson weighting follows |
| [Review deck quality](specs/2026-10-16-review-deck-quality-design.md) | Proposed: more cards, honest empty deck, next-review line, leeches, suspend and schedule health |
| [Curriculum wards](specs/2026-10-20-curriculum-wards-design.md) | Proposed: seven tracks over ~18 wards on the Steps Method's ordering, five practice modes, endgames and the checks-captures-threats thread |
| [Tactic recognition](specs/2026-10-18-tactic-recognition-design.md) | Gate built; proposed multi-label classifier over Lichess's 69 themes trained on all 6.1M puzzles, and dynamic-similarity matching for families |
| [Weakness model](specs/2026-10-17-weakness-model-design.md) | Proposed per-skill ability estimates in place of mistake-count sorting, card families built from related positions, and a time-budgeted pace |
| [Answer feedback](specs/2026-10-14-answer-feedback-design.md) | Verdict sheet and combo progress bar in practice and game review |
| [Instant practice](specs/2026-10-15-instant-practice-design.md) | Solutions served with positions; instant moves and hints, background saves |
| [Session-end beats](specs/2026-10-14-session-end-beats-design.md) | Results, streak-extended and memory beats at the end of practice, review and daily steps |
| [Games library](specs/2026-10-12-games-design.md) | Native library, next review, search/filters and paginated game summaries |
| [Navigation design](specs/2026-10-12-knightly-navigation-design.md) | Approved: one screen with no tab bar, the path's header, Games/Progress/Account modals and the web without a sidebar |
| [Today daily review](specs/2026-10-13-today-daily-review-design.md) | Released daily review: daily lesson, streaks, freezes, reminders and backend summary |
| [Your watch](specs/2026-10-18-watch-time-anchor-design.md) | Learner-chosen watch time and "After I …" anchor, onboarding/settings, once-a-day reminders with back-off |
| [The watch story](specs/2026-10-18-watch-story-design.md) | Proposed: Watch, Games and Progress rebuilt around the nightly watch; slip states, map of nights with star-driven ranks, the watch seen from the wall |
| [The path home](specs/2026-10-19-path-home-design.md) | Accepted; step 1 built (the path home from today's data, Progress without the map); server extra watches and the schedule ahead open. Home is one path of watches ordered by the review schedule, sections are ranks |
| [The ward path](specs/2026-10-20-ward-path-design.md) | Proposed: home's sections become the curriculum's eighteen posts through a real castle's Outer, Middle and Inner Wards to the keep (place name leads, plain topic beneath), lessons as nodes, ranks every third post, watch and chess lore, arrival/cleared/placement moments |
| [The watch kit](specs/2026-10-18-watch-kit-design.md) | Proposed: every sprite, scene, effect and sound addressed by role in one manifest so art is swappable; contract tests and the staged build plan for the watch |
| [Move grading parity](specs/2026-10-20-move-grading-parity-design.md) | Implemented in the backend, not deployed: rating-matched severity (fitted curve), a narrower Miss and Great in any position, so grades read as Chess.com's; reference set and production drift review open |
| [Progress specification](specs/2026-10-11-progress-design.md) | Approved redesign: rating line, last-4-weeks habit card, five-axis skill shape with one action; now one sheet with All stats folded in |
| [Knightly direction](knightly-direction.md) | Accepted premise (every night, a short watch), the main-thing filter, story, references, tone and open decisions |
| [Art and motion direction](art-direction.md) | Proposed illustration, motion, reward juice and UI sound brief; deliverables for commissioned art |
| [Art style lock](art-style-lock.md) | Prompt pack and decision process for locking one AI-assisted illustration style, starting with the reward kit |
| [Current status](status.md) | Implemented scope, product gaps and remaining release checks |
| [Local development setup](foundation-development-environment.md) | Backend, Clerk and device configuration |
| [Runtime checks](runtime-verification.md) | Browser/native smoke commands and limits |
| [Chess.com import](chesscom-import.md) | Current integration and worker behavior |
| [Asset licenses](../assets/licenses/README.md) | Artwork/font attribution |

Keep instructions with their owner. Update specs when behavior changes and status
when a gap closes. Do not add research ledgers, completed plans or verification
chronologies; Git history holds earlier tracked material.
