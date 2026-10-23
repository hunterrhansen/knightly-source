#include "engine_runner.hpp"

#include "engine/include/multistockfish_light/stockfish_light.h"

#include <mutex>
#include <stdexcept>
#include <thread>

namespace knightly::stockfish {

namespace {

// The vendored shim owns one engine per process, so its listener is global too.
std::mutex listenerMutex;
Listener listener;
std::once_flag booted;

std::string lastError() {
  char buffer[512] = {0};
  stockfish_light_last_error(buffer, sizeof(buffer));
  return buffer;
}

// Reads engine output until it quits and hands it on in whole lines. Pipe reads
// can split a line, so an unfinished tail waits for the next read.
void readOutput() {
  std::string pending;
  while (const char* chunk = stockfish_light_stdout_read()) {
    pending += chunk;
    std::vector<std::string> lines;
    size_t from = 0;
    size_t end;
    while ((end = pending.find('\n', from)) != std::string::npos) {
      if (end > from) lines.emplace_back(pending, from, end - from);
      from = end + 1;
    }
    pending.erase(0, from);
    if (lines.empty()) continue;

    Listener current;
    {
      std::lock_guard<std::mutex> lock(listenerMutex);
      current = listener;
    }
    if (current) current(lines);
  }
}

void boot() {
  if (stockfish_light_init() != 0) {
    throw std::runtime_error("Stockfish could not start: " + lastError());
  }
  std::thread(readOutput).detach();
  std::thread([] { stockfish_light_main(); }).detach();
}

} // namespace

void start(Listener onLines) {
  {
    std::lock_guard<std::mutex> lock(listenerMutex);
    listener = std::move(onLines);
  }
  // A throwing boot leaves the flag unset, so a later start can retry.
  std::call_once(booted, boot);
}

void send(const std::string& command) {
  std::string line = command + "\n";
  const ssize_t written = stockfish_light_stdin_write(line.data());
  if (written < 0) {
    throw std::runtime_error("Stockfish did not accept a command: " + lastError());
  }
}

} // namespace knightly::stockfish
