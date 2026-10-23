import ExpoModulesCore

/// Stockfish compiled into the app: `start` boots it once, `send` writes a UCI
/// command, and its output arrives as `onLines` events in complete lines.
public class KnightlyStockfishModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KnightlyStockfish")

    Events("onLines")

    Function("start") { [weak self] in
      try KnightlyStockfishBridge.start { lines in
        self?.sendEvent("onLines", ["lines": lines])
      }
    }

    Function("send") { (command: String) in
      try KnightlyStockfishBridge.send(command)
    }
  }
}
