#!/bin/bash
# persona.sh: open one Safe Circle persona in its own isolated Chrome window (macOS).
#
#   bash scripts/persona.sh counsellor invite   # first time: open this person's Tide sign-up link
#   bash scripts/persona.sh counsellor          # afterwards: open the app as this person
#
# Each persona gets its own Chrome profile under data/browser-profiles/<who> (gitignored), so
# four Tide identities never share cookies. This keeps sign-ups from linking the wrong account,
# and lets you keep student, buddy, counsellor and committee open side by side for the demo.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WHO="${1:-}"
MODE="${2:-app}"
APP_URL="${APP_URL:-http://localhost:3000}"

case "$WHO" in
  counsellor|buddy|committee|student) ;;
  *) echo "usage: $0 <counsellor|buddy|committee|student> [invite]" >&2; exit 1 ;;
esac

if [ "$MODE" = "invite" ]; then
  LINKS="$PROJECT_DIR/data/invite-links.txt"
  URL="$(awk -v w="$WHO" '$1 == w { print $2 }' "$LINKS" 2>/dev/null || true)"
  if [ -z "$URL" ]; then
    echo "No invite link for $WHO in $LINKS. Run npm run init first." >&2
    exit 1
  fi
else
  URL="$APP_URL"
fi

PROFILE="$PROJECT_DIR/data/browser-profiles/$WHO"
mkdir -p "$PROFILE"
# -n: a separate Chrome instance, so --user-data-dir applies even if Chrome is already open.
open -na "Google Chrome" --args \
  --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
  --window-name="Safe Circle: $WHO" "$URL"
echo "Opened $WHO ($MODE) in an isolated Chrome window."
