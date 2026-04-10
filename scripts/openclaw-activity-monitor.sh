#!/usr/bin/env bash
set -euo pipefail
python3 /home/roshan/.openclaw/workspace-nova/scripts/openclaw-activity-monitor.py "${1:-2}"
