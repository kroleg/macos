#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Add DNS Domain
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🌐
# @raycast.argument1 { "type": "text", "placeholder": "domain" }
# @raycast.packageName DNS Routes

# Documentation:
# @raycast.description Add a domain to the dns-routes _default group

set -euo pipefail

DOMAIN="$1"
URL="http://dns-routes.internal/rules/quick-add"

BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT

STATUS=$(curl -sS -o "$BODY_FILE" -w '%{http_code}' -X POST "$URL" \
  -H 'Accept: application/json' \
  --data-urlencode "domain=${DOMAIN}")

if [ "$STATUS" = "200" ]; then
  echo "Added ${DOMAIN}"
  dig +short $DOMAIN
else
  echo "Failed (HTTP ${STATUS}): $(cat "$BODY_FILE")"
  exit 1
fi
