#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ROOT / 'trackers.json'


def main() -> int:
    if len(sys.argv) != 3:
        print('usage: update_tracker_stores.py <tracker_id> <stores_json_file>')
        return 2
    tracker_id = sys.argv[1]
    stores = json.loads(Path(sys.argv[2]).read_text())
    data = json.loads(TRACKERS.read_text())
    for tracker in data.get('trackers', []):
        if tracker.get('id') == tracker_id:
            tracker['stores'] = stores
            TRACKERS.write_text(json.dumps(data, indent=2) + '\n')
            print(json.dumps({'ok': True, 'tracker_id': tracker_id, 'stores': len(stores)}))
            return 0
    print(json.dumps({'ok': False, 'error': 'tracker_not_found', 'tracker_id': tracker_id}))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
