#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ROOT / 'trackers.json'


def main() -> int:
    if len(sys.argv) < 5:
        print('usage: add_tracker.py <name> <model> <target_price_or_dash> <store_json_file>')
        return 2
    name = sys.argv[1].strip()
    model = sys.argv[2].strip()
    target_raw = sys.argv[3].strip()
    store_json_file = Path(sys.argv[4]).resolve()
    stores = json.loads(store_json_file.read_text())

    data = json.loads(TRACKERS.read_text())
    trackers = data.setdefault('trackers', [])
    tracker_id = f"{model.lower().replace(' ', '-').replace('/', '-') }"
    trackers.append({
        'id': tracker_id,
        'name': name,
        'model': model,
        'target_price': None if target_raw == '-' else float(target_raw),
        'currency': 'NZD',
        'stores': stores,
        'enabled': True,
    })
    TRACKERS.write_text(json.dumps(data, indent=2) + '\n')
    print(json.dumps({'ok': True, 'tracker_id': tracker_id, 'stores_added': len(stores)}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
