#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / 'scripts' / 'check_prices.py'
STATE = ROOT / 'state' / 'latest.json'


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def previous_global_lows(state: dict) -> dict:
    result = {}
    for tracker_id, stores in state.items():
        lowest = None
        for _, item in stores.items():
            price = item.get('price')
            if price is not None and (lowest is None or price < lowest):
                lowest = price
        result[tracker_id] = lowest
    return result


def main() -> int:
    before = previous_global_lows(load_json(STATE, {}))
    proc = subprocess.run([sys.executable, str(CHECKER)], capture_output=True, text=True)
    if proc.returncode != 0:
        print(f'BLOCKED: checker failed\n{proc.stderr.strip() or proc.stdout.strip()}')
        return proc.returncode

    after_state = load_json(STATE, {})
    after = previous_global_lows(after_state)
    lines = []
    for tracker_id, new_low in after.items():
        old_low = before.get(tracker_id)
        if new_low is None:
            continue
        if old_low is None or new_low < old_low:
            cheapest_store = None
            for store_name, item in after_state.get(tracker_id, {}).items():
                if item.get('price') == new_low:
                    cheapest_store = store_name
                    break
            lines.append(f'- {tracker_id}: new lowest price NZ${new_low:.2f} at {cheapest_store}')

    if not lines:
        print('NO_REPLY')
        return 0

    print('Price tracker alert:')
    print('\n'.join(lines))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
