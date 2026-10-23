require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'KnightlyStockfish'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = { :type => 'GPL-3.0-only', :file => 'LICENSE' }
  s.author         = 'Knightly'
  s.homepage       = 'https://github.com/lichess-org/dart-multistockfish'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/hunterrhansen/knightly.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  engine = 'cpp/engine'
  s.source_files = [
    'ios/*.{h,mm,swift}',
    'cpp/*.{hpp,cpp}',
    "#{engine}/*.{h,cpp}",
    "#{engine}/include/**/*.h",
    "#{engine}/StockfishLight/src/**/*.{h,cpp}",
  ]
  # Swift sees the bridge; the engine's headers stay internal.
  s.public_header_files = 'ios/KnightlyStockfishBridge.h'

  # Engine flags follow lichess-org/dart-multistockfish's light flavour. Every
  # configuration is optimised: a debug engine searches too slowly to judge.
  # No LTO: the embedded net uses an `.incbin` directive LTO cannot assemble.
  engine_flags = '-DUSE_PTHREADS -DIS_64BIT -DUSE_POPCNT -DNDEBUG -O3 -funroll-loops'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'HEADER_SEARCH_PATHS' => "\"$(PODS_TARGET_SRCROOT)/#{engine}/nnue\" \"$(PODS_TARGET_SRCROOT)/#{engine}\"",
    'OTHER_CPLUSPLUSFLAGS' => "$(inherited) #{engine_flags}",
    'OTHER_CPLUSPLUSFLAGS[arch=arm64]' => "$(inherited) #{engine_flags} -DUSE_NEON=8",
  }
end
