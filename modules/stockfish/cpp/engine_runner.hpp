#pragma once

#include <functional>
#include <string>
#include <vector>

namespace knightly::stockfish {

using Listener = std::function<void(const std::vector<std::string>&)>;

/// Starts the one process-wide engine on the first call and hands its output
/// to `onLines` in complete lines, on a background thread. A later call only
/// replaces the listener. Throws std::runtime_error if the engine cannot start.
void start(Listener onLines);

/// Sends one UCI command (a newline is appended). Throws std::runtime_error if
/// the engine does not accept it.
void send(const std::string& command);

} // namespace knightly::stockfish
