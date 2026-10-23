cmake_minimum_required(VERSION 3.9.0)
project(knightlystockfish)

set(CMAKE_CXX_STANDARD 20)

set(ENGINE_DIR ${CMAKE_SOURCE_DIR}/../cpp/engine)
file(GLOB_RECURSE ENGINE_SOURCES ${ENGINE_DIR}/StockfishLight/src/*.cpp)

add_library(knightlystockfish SHARED
        src/main/cpp/jni-adapter.cpp
        ../cpp/engine_runner.cpp
        ${ENGINE_DIR}/stockfish_light.cpp
        ${ENGINE_DIR}/sfio.cpp
        ${ENGINE_SOURCES}
)

include_directories(
        "../cpp"
        "${ENGINE_DIR}"
        # The embedded net's `.incbin` directive is resolved through the include path.
        "${ENGINE_DIR}/nnue"
)

# Engine flags follow lichess-org/dart-multistockfish's light flavour (see the podspec).
target_compile_definitions(knightlystockfish PRIVATE USE_PTHREADS NDEBUG)
target_compile_options(knightlystockfish PRIVATE -O3 -funroll-loops)
if(ANDROID_ABI STREQUAL arm64-v8a)
  target_compile_definitions(knightlystockfish PRIVATE IS_64BIT USE_POPCNT USE_NEON=8)
elseif(ANDROID_ABI STREQUAL x86_64)
  target_compile_definitions(knightlystockfish PRIVATE IS_64BIT)
endif()

find_library(LOG_LIB log)
target_link_libraries(knightlystockfish ${LOG_LIB} android)
