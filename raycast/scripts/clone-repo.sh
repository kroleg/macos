#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Clone repo
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🤖
# @raycast.argument1 { "type": "text", "placeholder": "repo" }

# Documentation:
# @raycast.description clone repo from stashaway gitlab

/Users/vitaliy/.stash/bin/stash repo clone $1
