#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ROOT / 'trackers.json'


def main() -> int:
    if len(sys.argv) != 2:
        print('usage: remove_tracker.py <tracker_id>')
        return 2
    tracker_id = sys.argv[1]
    data = json.loads(TRACKERS.read_text())
    before = len(data.get('trackers', []))
    data['trackers'] = [t for t in data.get('trackers', []) if t.get('id') != tracker_id]
    after = len(data['trackers'])
    TRACKERS.write_text(json.dumps(data, indent=2) + '\n')
    print(json.dumps({'ok': True, 'removed': before - after, 'tracker_id': tracker_id}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
