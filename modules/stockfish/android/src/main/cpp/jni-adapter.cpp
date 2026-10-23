#include <jni.h>

#include <stdexcept>
#include <string>
#include <vector>

#include "engine_runner.hpp"

namespace {

JavaVM* vm = nullptr;
jobject listener = nullptr;  // a global reference, replaced by each start
jmethodID onLines = nullptr;

void throwJava(JNIEnv* env, const std::exception& failure) {
  jclass error = env->FindClass("java/lang/RuntimeException");
  env->ThrowNew(error, failure.what());
}

// Runs on the engine's reader thread, which stays attached for its lifetime.
void deliver(const std::vector<std::string>& lines) {
  JNIEnv* env = nullptr;
  if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK &&
      vm->AttachCurrentThreadAsDaemon(&env, nullptr) != JNI_OK)
    return;
  jclass stringClass = env->FindClass("java/lang/String");
  jobjectArray array =
      env->NewObjectArray(static_cast<jsize>(lines.size()), stringClass, nullptr);
  for (size_t i = 0; i < lines.size(); i++) {
    jstring line = env->NewStringUTF(lines[i].c_str());
    env->SetObjectArrayElement(array, static_cast<jsize>(i), line);
    env->DeleteLocalRef(line);
  }
  if (listener && onLines) env->CallVoidMethod(listener, onLines, array);
  if (env->ExceptionCheck()) env->ExceptionClear();
  env->DeleteLocalRef(array);
  env->DeleteLocalRef(stringClass);
}

}  // namespace

extern "C" JNIEXPORT jint JNI_OnLoad(JavaVM* loaded, void*) {
  vm = loaded;
  return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT void JNICALL
Java_app_knightly_stockfish_KnightlyStockfishModule_nativeStart(
    JNIEnv* env, jobject, jobject next) {
  if (listener) env->DeleteGlobalRef(listener);
  listener = env->NewGlobalRef(next);
  jclass type = env->GetObjectClass(next);
  onLines = env->GetMethodID(type, "onLines", "([Ljava/lang/String;)V");
  env->DeleteLocalRef(type);
  try {
    knightly::stockfish::start(deliver);
  } catch (const std::exception& failure) {
    throwJava(env, failure);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_app_knightly_stockfish_KnightlyStockfishModule_nativeSend(
    JNIEnv* env, jobject, jstring command) {
  const char* chars = env->GetStringUTFChars(command, nullptr);
  std::string line(chars);
  env->ReleaseStringUTFChars(command, chars);
  try {
    knightly::stockfish::send(line);
  } catch (const std::exception& failure) {
    throwJava(env, failure);
  }
}
