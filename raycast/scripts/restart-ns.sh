#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Restart Netskope Private Access
# @raycast.mode silent

"/Library/Application Support/Netskope/STAgent/nsdiag" -t disable;
sleep 3;
"/Library/Application Support/Netskope/STAgent/nsdiag" -t enable;
echo "Restarted NS private access"
