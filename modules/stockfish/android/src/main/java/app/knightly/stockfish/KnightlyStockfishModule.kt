package app.knightly.stockfish

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Receives the engine's output in complete lines, on its reader thread. */
interface LineListener {
  fun onLines(lines: Array<String>)
}

/** Stockfish compiled into the app: `start` boots it once, `send` writes a UCI
 * command, and its output arrives as `onLines` events in complete lines. */
class KnightlyStockfishModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KnightlyStockfish")

    Events("onLines")

    Function("start") {
      nativeStart(
        object : LineListener {
          override fun onLines(lines: Array<String>) {
            sendEvent("onLines", mapOf("lines" to lines.toList()))
          }
        },
      )
    }

    Function("send") { command: String -> nativeSend(command) }
  }

  private external fun nativeStart(listener: LineListener)

  private external fun nativeSend(command: String)

  companion object {
    init {
      System.loadLibrary("knightlystockfish")
    }
  }
}
