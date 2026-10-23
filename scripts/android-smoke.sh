#!/usr/bin/env bash
# Installs the debug APK on the running emulator, launches the app and
# collects a screenshot, the app log and WebView console output.
set -x
OUT=smoke-out
mkdir -p "$OUT"
APK=android/app/build/outputs/apk/debug/app-debug.apk
PKG=com.nexiuska.marblerush

adb wait-for-device
adb shell dumpsys package com.google.android.webview | grep -m1 versionName > "$OUT/webview-version.txt" || true
adb install -r "$APK" > "$OUT/install.txt" 2>&1
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/start.txt" 2>&1
sleep 20
adb exec-out screencap -p > "$OUT/screen-20s.png"
# tap roughly where the PLAY / ENDLESS RUN button sits, then capture again
adb shell input tap 540 1250 || true
sleep 6
adb exec-out screencap -p > "$OUT/screen-after-tap.png"
adb logcat -d > "$OUT/logcat-full.txt"
grep -iE "Capacitor|chromium|Console|AndroidRuntime|FATAL|WebView|$PKG" "$OUT/logcat-full.txt" > "$OUT/logcat-app.txt" || true
adb shell pidof "$PKG" > "$OUT/pid.txt" 2>&1 || echo "NOT RUNNING" > "$OUT/pid.txt"
exit 0
