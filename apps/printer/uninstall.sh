#!/bin/bash
# Removes the Dashboard weekly job from launchd. Settings (.env), state
# (~/Library/Application Support/dashboard) and logs are kept.
set -euo pipefail
LABEL="org.dashboard.weekly"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ -f "$PLIST" ]; then rm "$PLIST"; fi
echo "Removed the Dashboard weekly job. Your settings, state and logs are still there."
