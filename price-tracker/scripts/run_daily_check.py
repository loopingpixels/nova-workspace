#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / 'scripts' / 'check_prices.py'


def main() -> int:
    proc = subprocess.run([sys.executable, str(CHECKER)], capture_output=True, text=True)
    if proc.returncode != 0:
        print(f'BLOCKED: checker failed\n{proc.stderr.strip() or proc.stdout.strip()}')
        return proc.returncode

    payload = json.loads(proc.stdout)
    alerts = payload.get('alerts', [])
    if not alerts:
        print('NO_REPLY')
        return 0

    lines = ['Price tracker alert:']
    for alert in alerts:
        if alert['type'] == 'price_drop':
            lines.append(f"- {alert['tracker_id']} at {alert['store']}: {alert['old_price']} -> {alert['new_price']} NZD")
            lines.append(f"  {alert['url']}")
        elif alert['type'] == 'target_hit':
            lines.append(f"- {alert['tracker_id']} at {alert['store']}: hit target {alert['target_price']} NZD, now {alert['new_price']} NZD")
            lines.append(f"  {alert['url']}")
    print('\n'.join(lines))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
