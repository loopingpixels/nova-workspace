#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ROOT / 'trackers.json'
STATE = ROOT / 'state' / 'latest.json'


def main() -> int:
    trackers = json.loads(TRACKERS.read_text()).get('trackers', []) if TRACKERS.exists() else []
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    rows = []
    for tracker in trackers:
        tracker_id = tracker['id']
        stores = state.get(tracker_id, {})
        lowest = None
        lowest_store = None
        for store_name, item in stores.items():
            price = item.get('price')
            if price is not None and (lowest is None or price < lowest):
                lowest = price
                lowest_store = store_name
        rows.append({
            'id': tracker_id,
            'name': tracker['name'],
            'lowest_price': lowest,
            'lowest_store': lowest_store,
            'enabled': tracker.get('enabled', True),
        })
    print(json.dumps({'trackers': rows}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
