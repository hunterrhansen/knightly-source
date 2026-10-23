#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Objective-C entry to the C++ engine runner, so the Swift module can reach it.
@interface KnightlyStockfishBridge : NSObject

/// Starts the engine once per process; `handler` receives its output in
/// complete lines on a background thread.
+ (BOOL)startWithHandler:(void (^)(NSArray<NSString *> *lines))handler
                   error:(NSError **)error;

/// Sends one UCI command.
+ (BOOL)send:(NSString *)command error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
