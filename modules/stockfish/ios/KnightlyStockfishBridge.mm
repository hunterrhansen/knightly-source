#import "KnightlyStockfishBridge.h"

#include "../cpp/engine_runner.hpp"

#include <stdexcept>

static NSError *engineError(const std::exception &failure) {
  return [NSError errorWithDomain:@"KnightlyStockfish"
                             code:1
                         userInfo:@{
                           NSLocalizedDescriptionKey : @(failure.what())
                         }];
}

@implementation KnightlyStockfishBridge

+ (BOOL)startWithHandler:(void (^)(NSArray<NSString *> *))handler
                   error:(NSError **)error {
  try {
    knightly::stockfish::start([handler](const std::vector<std::string> &lines) {
      @autoreleasepool {
        NSMutableArray<NSString *> *strings =
            [NSMutableArray arrayWithCapacity:lines.size()];
        for (const auto &line : lines) {
          NSString *string = [NSString stringWithUTF8String:line.c_str()];
          if (string) [strings addObject:string];
        }
        handler(strings);
      }
    });
    return YES;
  } catch (const std::exception &failure) {
    if (error) *error = engineError(failure);
    return NO;
  }
}

+ (BOOL)send:(NSString *)command error:(NSError **)error {
  try {
    knightly::stockfish::send(command.UTF8String);
    return YES;
  } catch (const std::exception &failure) {
    if (error) *error = engineError(failure);
    return NO;
  }
}

@end
