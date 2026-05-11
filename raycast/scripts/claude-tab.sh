#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Claude Code (new tab)
# @raycast.mode silent
# @raycast.icon 🤖

# Ghostty has no CLI to open a new tab in an existing window yet
# (ghostty-org/ghostty#12136). Fall back to AppleScript keystrokes
# when Ghostty is already running; otherwise spawn a fresh window.

if pgrep -xi ghostty >/dev/null; then
    osascript <<'EOF'
tell application "Ghostty" to activate
delay 0.15
tell application "System Events"
    keystroke "t" using command down
    delay 0.25
    keystroke "cd ~/code && claude"
    key code 36
end tell
EOF
else
    open -a Ghostty -n --args --working-directory="$HOME/code" -e "claude"
fi
