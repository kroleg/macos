#!/bin/bash
# Build Keymap.app into ~/Applications and (re)start it.
# keymap.json comes from zmk-corne-dongle/keymap-drawer/draw.sh.
set -e

cd "$(dirname "$0")"
APP="$HOME/Applications/Keymap.app"
mkdir -p build

node --no-warnings page.ts > build/keymap.html

# icon
rm -rf build/icon.iconset && mkdir build/icon.iconset
for size in 16 32 128 256 512; do
  sips -z $size $size icon.png --out build/icon.iconset/icon_${size}x${size}.png >/dev/null
  sips -z $((size * 2)) $((size * 2)) icon.png --out build/icon.iconset/icon_${size}x${size}@2x.png >/dev/null
done
iconutil -c icns build/icon.iconset -o build/icon.icns

rm -rf build/Keymap.app
mkdir -p build/Keymap.app/Contents/MacOS build/Keymap.app/Contents/Resources
swiftc -O main.swift -o build/Keymap.app/Contents/MacOS/Keymap
cp build/keymap.html build/icon.icns build/Keymap.app/Contents/Resources/
cat > build/Keymap.app/Contents/Info.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Keymap</string>
  <key>CFBundleIdentifier</key><string>com.kroleg.keymap</string>
  <key>CFBundleExecutable</key><string>Keymap</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF

pkill -x Keymap || true
while pgrep -x Keymap >/dev/null; do sleep 0.1; done
mkdir -p "$HOME/Applications"
rm -rf "$APP"
cp -R build/Keymap.app "$APP"
# right after the copy LaunchServices may not know the new bundle yet (error -600)
open "$APP" 2>/dev/null || { sleep 1; open "$APP"; }
echo "Installed $APP"
