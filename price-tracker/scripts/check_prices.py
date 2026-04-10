#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ROOT / 'trackers.json'
STATE_DIR = ROOT / 'state'
HISTORY_DIR = ROOT / 'history'

PRICE_PATTERNS = [
    re.compile(r'\$\s*([0-9]+(?:[\.,][0-9]{2})?)'),
    re.compile(r'NZ\$\s*([0-9]+(?:[\.,][0-9]{2})?)', re.I),
]


@dataclass
class Observation:
    tracker_id: str
    store_name: str
    url: str
    price: float | None
    in_stock: bool | None
    title: str | None
    checked_at: str
    raw_status: str


def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 PriceTracker/1.0'})
    with urlopen(req, timeout=25) as resp:
        return resp.read().decode('utf-8', errors='ignore')


def extract_price(text: str) -> float | None:
    for pattern in PRICE_PATTERNS:
        match = pattern.search(text)
        if match:
            return float(match.group(1).replace(',', ''))
    return None


def extract_stock(text: str) -> bool | None:
    lowered = text.lower()
    if 'out of stock' in lowered or 'sold out' in lowered:
        return False
    if 'in stock' in lowered or 'available now' in lowered:
        return True
    return None


def extract_title(text: str) -> str | None:
    m = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
    if not m:
        return None
    return re.sub(r'\s+', ' ', m.group(1)).strip()


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + '\n')


def main() -> int:
    data = load_json(TRACKERS, {'version': 1, 'trackers': []})
    latest_path = STATE_DIR / 'latest.json'
    latest = load_json(latest_path, {})
    now = datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')
    history_file = HISTORY_DIR / f"{datetime.now(UTC).strftime('%Y-%m-%d')}.jsonl"
    history_file.parent.mkdir(parents=True, exist_ok=True)

    alerts = []
    for tracker in data.get('trackers', []):
        if not tracker.get('enabled', True):
            continue
        tracker_id = tracker['id']
        tracker_state = latest.setdefault(tracker_id, {})
        for store in tracker.get('stores', []):
            url = store['url']
            store_name = store['name']
            try:
                html = fetch(url)
                obs = Observation(
                    tracker_id=tracker_id,
                    store_name=store_name,
                    url=url,
                    price=extract_price(html),
                    in_stock=extract_stock(html),
                    title=extract_title(html),
                    checked_at=now,
                    raw_status='ok',
                )
            except Exception as exc:
                obs = Observation(
                    tracker_id=tracker_id,
                    store_name=store_name,
                    url=url,
                    price=None,
                    in_stock=None,
                    title=None,
                    checked_at=now,
                    raw_status=f'error:{type(exc).__name__}',
                )

            previous = tracker_state.get(store_name)
            current = {
                'url': obs.url,
                'price': obs.price,
                'in_stock': obs.in_stock,
                'title': obs.title,
                'checked_at': obs.checked_at,
                'raw_status': obs.raw_status,
            }
            tracker_state[store_name] = current
            with history_file.open('a') as fh:
                fh.write(json.dumps({
                    'tracker_id': tracker_id,
                    'store_name': store_name,
                    **current,
                }) + '\n')

            if previous:
                prev_price = previous.get('price')
                if prev_price is not None and obs.price is not None and obs.price < prev_price:
                    alerts.append({
                        'tracker_id': tracker_id,
                        'store': store_name,
                        'old_price': prev_price,
                        'new_price': obs.price,
                        'url': url,
                        'type': 'price_drop',
                    })
            target = tracker.get('target_price')
            if target is not None and obs.price is not None and obs.price <= target:
                alerts.append({
                    'tracker_id': tracker_id,
                    'store': store_name,
                    'target_price': target,
                    'new_price': obs.price,
                    'url': url,
                    'type': 'target_hit',
                })

    save_json(latest_path, latest)
    print(json.dumps({'ok': True, 'alerts': alerts, 'state_file': str(latest_path), 'history_file': str(history_file)}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
