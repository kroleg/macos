#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Keymap Viewer
# @raycast.mode silent

# Optional parameters:
# @raycast.icon ⌨️
# @raycast.packageName Keyboard

# Documentation:
# @raycast.description Show/hide the floating keymap viewer window (build: ~/code/os/keymap/build.sh)

open -a "$HOME/Applications/Keymap.app"
