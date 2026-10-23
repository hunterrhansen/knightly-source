# knightly-stockfish

Stockfish 19 compiled into the iOS and Android app as a local Expo module, for
review's side lines. Use it through `src/lib/engine/stockfish.ts`, not directly.

`cpp/engine/` is copied unchanged from the light flavour of
[lichess-org/dart-multistockfish](https://github.com/lichess-org/dart-multistockfish)
(commit `fd8dcea`, first vendored here in `52e5fde`). It contains Stockfish 19,
Lichess's private-I/O and small-net patches, the C interface (`stockfish_light_*`)
and the 1.1 MB net it embeds with `.incbin`. Only `src/main.cpp`, `src/Makefile`
and `src/universal/` were left out. To update it, follow that repository's
`UPDATING.md` and copy the same files.

Knightly's code is small:

- `cpp/engine_runner.cpp` starts the engine and a reader thread once per process
  and hands complete output lines to a listener.
- `ios/` bridges it to Swift through Objective-C++ (`KnightlyStockfishBridge`);
  `android/` through JNI. Both expose `start()`, `send(command)` and `onLines`
  events from `KnightlyStockfishModule`.

Build constraints carried over from Lichess: no LTO (it breaks `.incbin`), and the
net is found through the `nnue/` include path. Release-level optimisation applies
in every configuration because a debug engine is too slow to judge. New native
code needs `pod install` (iOS) and a rebuilt development client.

The module is GPL-3.0 (`LICENSE`), and linking it makes the app's distributed
builds subject to the GPL; see the
[line exploration spec](../../docs/specs/2026-10-22-line-exploration-design.md#licence).
