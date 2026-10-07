#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Disconnect Gamepad
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🎮
# @raycast.packageName Bluetooth

# Documentation:
# @raycast.description Disconnect the PS5 gamepad over Bluetooth

set -euo pipefail

GAMEPAD="E8-47-3A-7D-F1-70" # PS5 gamepad doggy
BLUEUTIL=/opt/homebrew/bin/blueutil

if [ "$("$BLUEUTIL" --is-connected "$GAMEPAD")" != "1" ]; then
  echo "Gamepad is not connected"
  exit 0
fi

if "$BLUEUTIL" --disconnect "$GAMEPAD" --wait-disconnect "$GAMEPAD" 5; then
  echo "Gamepad disconnected"
else
  echo "Failed to disconnect gamepad"
  exit 1
fi
