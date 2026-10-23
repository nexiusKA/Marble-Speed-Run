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
for t in 10 20 30 40; do
  sleep 10
  adb exec-out screencap -p > "$OUT/screen-${t}s.png"
done
# Tap the ENDLESS RUN button (position relative to the screen size), then capture
SIZE=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1)
W=${SIZE%x*}; H=${SIZE#*x}
adb shell input tap $((W / 2)) $((H * 56 / 100)) || true   # ENDLESS RUN -> difficulty panel
sleep 3
adb shell input tap $((W / 2)) $((H * 62 / 100)) || true   # PLAY
sleep 8                                                     # 3-2-1 countdown, then running
adb exec-out screencap -p > "$OUT/screen-after-tap.png"

# Background test: is the app still playing audio after pressing HOME?
UID_APP=$(adb shell pm list packages -U "$PKG" | grep -o 'uid:[0-9]*' | head -1 | cut -d: -f2)
echo "uid=$UID_APP" > "$OUT/audio.txt"
echo "--- playing (foreground)" >> "$OUT/audio.txt"
adb shell dumpsys audio | grep -E "AudioPlaybackConfiguration.*u/pid:${UID_APP}/" >> "$OUT/audio.txt" || true
adb shell input keyevent KEYCODE_HOME
sleep 4
echo "--- after HOME (background)" >> "$OUT/audio.txt"
adb shell dumpsys audio | grep -E "AudioPlaybackConfiguration.*u/pid:${UID_APP}/" >> "$OUT/audio.txt" || true
adb shell am start -n "$PKG/.MainActivity" > /dev/null 2>&1
sleep 2
adb exec-out screencap -p > "$OUT/screen-after-resume.png"
echo "--- after resume" >> "$OUT/audio.txt"
adb shell dumpsys audio | grep -E "AudioPlaybackConfiguration.*u/pid:${UID_APP}/" >> "$OUT/audio.txt" || true
adb logcat -d > "$OUT/logcat-full.txt"
grep -iE "Capacitor|chromium|Console|AndroidRuntime|FATAL|WebView|$PKG" "$OUT/logcat-full.txt" > "$OUT/logcat-app.txt" || true
adb shell pidof "$PKG" > "$OUT/pid.txt" 2>&1 || echo "NOT RUNNING" > "$OUT/pid.txt"
exit 0
