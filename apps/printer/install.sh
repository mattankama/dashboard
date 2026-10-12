#!/bin/bash
# Installs the Dashboard weekly job as a launchd agent that runs every hour
# (and at login). Usage: ./install.sh [--dry-run] [--print-this-week]
#   --dry-run          only render and check the job file; install nothing
#   --print-this-week  don't mark this week done first (it may print right away)
# Run it again after upgrading Node: the job uses Node's full path.
set -euo pipefail
cd "$(dirname "$0")"
APP_DIR="$(pwd)"
LABEL="org.dashboard.weekly"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

DRY_RUN=false
PRINT_THIS_WEEK=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --print-this-week) PRINT_THIS_WEEK=true ;;
    *) echo "Unknown option: $arg (use --dry-run or --print-this-week)" >&2; exit 2 ;;
  esac
done

# Node 24+, wherever nvm put it (launchd doesn't load nvm, so the job needs the full path).
NODE="$(command -v node || true)"
if [ -z "$NODE" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null
  NODE="$(command -v node || true)"
fi
if [ -z "$NODE" ]; then echo "Node isn't installed (or nvm isn't set up). Install Node 24 first." >&2; exit 1; fi
MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 24 ]; then echo "Node 24 or newer is needed; found $("$NODE" --version)." >&2; exit 1; fi
if [ ! -d node_modules ]; then echo "Run 'npm ci' in apps/printer first." >&2; exit 1; fi
if [ ! -f .env ]; then echo "Note: apps/printer/.env doesn't exist yet. The job will remind you until it's filled in (cp .env.example .env)."; fi

RENDERED="$(mktemp -t dashboard-plist)"
"$NODE" src/launchd.ts "$NODE" "$APP_DIR" "$HOME" > "$RENDERED"
plutil -lint "$RENDERED" >/dev/null

if $DRY_RUN; then
  cat "$RENDERED"
  rm -f "$RENDERED"
  echo
  echo "Dry run: the job file above is valid. Nothing was installed."
  exit 0
fi

# Installing shouldn't print by surprise: mark this week done unless asked not to.
if ! $PRINT_THIS_WEEK; then "$NODE" src/weekly.ts --mark-done; fi

mkdir -p "$HOME/Library/LaunchAgents"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
mv "$RENDERED" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed: the Dashboard job now runs every hour and prints on Sundays at 09:00."
echo "Check on it any time with: npm run status"
