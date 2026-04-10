#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
TRACKERS = ROOT / 'trackers.json'
STATE_DIR = ROOT / 'state'
HISTORY_DIR = ROOT / 'history'
BROWSER_FETCH = ROOT / 'scripts' / 'browser_fetch_price.py'
BROWSER_PYTHON = Path('/home/roshan/.openclaw/workspace-nova/.price-tracker-venv/bin/python')

GENERIC_PRICE_PATTERNS = [
    re.compile(r'priceCurrency"\s*:\s*"NZD"\s*,\s*"price"\s*:\s*"([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
    re.compile(r'"price"\s*:\s*"([0-9]+(?:[\.,][0-9]{2})?)"\s*,\s*"priceCurrency"\s*:\s*"NZD"', re.I),
    re.compile(r'product:price:amount"\s*content="([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
    re.compile(r'woocommerce-Price-amount[^>]*>\s*<bdi>\s*\$?\s*([0-9]+(?:[\.,][0-9]{2})?)', re.I),
    re.compile(r'NZ\$\s*([0-9]+(?:[\.,][0-9]{2})?)', re.I),
    re.compile(r'\$\s*([1-9][0-9]{1,4}(?:[\.,][0-9]{2})?)'),
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
    validation: str = 'ok'
    source_type: str = 'direct'


def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 PriceTracker/1.0'})
    with urlopen(req, timeout=25) as resp:
        return resp.read().decode('utf-8', errors='ignore')


def extract_title(text: str) -> str | None:
    m = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
    if not m:
        return None
    return re.sub(r'\s+', ' ', m.group(1)).strip()


def extract_stock_generic(text: str) -> bool | None:
    lowered = text.lower()
    if 'out of stock' in lowered or 'sold out' in lowered or 'unavailable' in lowered:
        return False
    if 'in stock' in lowered or 'available now' in lowered:
        return True
    return None


def parse_price(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        value = float(raw.replace(',', ''))
    except ValueError:
        return None
    return value


def sane_price(value: float | None) -> bool:
    return value is not None and 50 <= value <= 10000


def extract_price_generic(text: str) -> float | None:
    for pattern in GENERIC_PRICE_PATTERNS:
        match = pattern.search(text)
        if match:
            price = parse_price(match.group(1))
            if sane_price(price):
                return price
    return None


def extract_price_pbtech(text: str) -> float | None:
    for pattern in [
        re.compile(r'product:price:amount"\s*content="([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
        re.compile(r'price\s*[:=]\s*"?([0-9]{3,5}(?:[\.,][0-9]{2})?)"?', re.I),
    ]:
        m = pattern.search(text)
        if m:
            price = parse_price(m.group(1))
            if sane_price(price):
                return price
    return None


def extract_price_warehouse(text: str) -> float | None:
    m = re.search(r'priceCurrency"\s*:\s*"NZD"\s*,\s*"price"\s*:\s*"([0-9]+(?:[\.,][0-9]{2})?)"', text, re.I)
    if m:
        price = parse_price(m.group(1))
        if sane_price(price):
            return price
    return None


def extract_price_phonewarehouse(text: str) -> float | None:
    for pattern in [
        re.compile(r'woocommerce-Price-amount[^>]*>\s*<bdi>\s*\$?\s*([0-9]+(?:[\.,][0-9]{2})?)', re.I),
        re.compile(r'"display_price"\s*:\s*([0-9]+(?:[\.,][0-9]{2})?)', re.I),
        re.compile(r'"price"\s*:\s*"([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
    ]:
        m = pattern.search(text)
        if m:
            price = parse_price(m.group(1))
            if sane_price(price):
                return price
    return None


def extract_price_pricespy(text: str) -> float | None:
    for pattern in [
        re.compile(r'The best price.*?\$([0-9]+(?:[\.,][0-9]{2})?)', re.I | re.S),
        re.compile(r'from \$([0-9]+(?:[\.,][0-9]{2})?)', re.I),
    ]:
        m = pattern.search(text)
        if m:
            price = parse_price(m.group(1))
            if sane_price(price):
                return price
    return None


def choose_adapter(url: str):
    host = urlparse(url).netloc.lower()
    if 'pbtech.co.nz' in host:
        return extract_price_pbtech, extract_stock_generic, 'direct'
    if 'thewarehouse.co.nz' in host:
        return extract_price_warehouse, extract_stock_generic, 'direct'
    if 'thephonewarehouse.co.nz' in host:
        return extract_price_phonewarehouse, extract_stock_generic, 'direct'
    if 'pricespy.co.nz' in host:
        return extract_price_pricespy, extract_stock_generic, 'comparison'
    if 'meta.com' in host:
        return extract_price_generic, extract_stock_generic, 'browser_fallback'
    return extract_price_generic, extract_stock_generic, 'direct'


def browser_fetch(url: str) -> tuple[float | None, str | None, str]:
    if not BROWSER_PYTHON.exists() or not BROWSER_FETCH.exists():
        return None, None, 'browser_unavailable'
    proc = subprocess.run([str(BROWSER_PYTHON), str(BROWSER_FETCH), url], capture_output=True, text=True)
    if proc.returncode != 0:
        return None, None, f'browser_error:{proc.returncode}'
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None, None, 'browser_bad_json'
    return payload.get('price'), payload.get('title'), 'browser_ok'


def validate_observation(price: float | None, title: str | None, tracker: dict, store_name: str | None = None) -> str:
    if price is None:
        return 'no_price'
    if not sane_price(price):
        return 'invalid_price'
    model = tracker.get('model', '').lower()
    normalized_model_tokens = [token for token in re.split(r'\s+', model) if token]
    title_lower = (title or '').lower()
    if store_name == 'Meta Store':
        if 'meta quest 3' in title_lower:
            return 'ok'
    if title and model:
        if model not in title_lower:
            if not all(token in title_lower for token in normalized_model_tokens[:3]):
                return 'title_mismatch'
    return 'ok'


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
            price_extractor, stock_extractor, source_type = choose_adapter(url)
            try:
                html = fetch(url)
                title = extract_title(html)
                price = price_extractor(html)
                in_stock = stock_extractor(html)
                raw_status = 'ok'
                if price is None and source_type == 'browser_fallback':
                    browser_price, browser_title, browser_status = browser_fetch(url)
                    if browser_price is not None:
                        price = browser_price
                        title = browser_title or title
                        raw_status = browser_status
                validation = validate_observation(price, title, tracker, store_name)
                if validation != 'ok':
                    price = None
                obs = Observation(
                    tracker_id=tracker_id,
                    store_name=store_name,
                    url=url,
                    price=price,
                    in_stock=in_stock,
                    title=title,
                    checked_at=now,
                    raw_status=raw_status,
                    validation=validation,
                    source_type=source_type,
                )
            except HTTPError as exc:
                obs = Observation(
                    tracker_id=tracker_id,
                    store_name=store_name,
                    url=url,
                    price=None,
                    in_stock=None,
                    title=None,
                    checked_at=now,
                    raw_status=f'error:HTTPError:{exc.code}',
                    validation='blocked',
                    source_type=source_type,
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
                    validation='blocked',
                    source_type=source_type,
                )

            previous = tracker_state.get(store_name)
            current = {
                'url': obs.url,
                'price': obs.price,
                'in_stock': obs.in_stock,
                'title': obs.title,
                'checked_at': obs.checked_at,
                'raw_status': obs.raw_status,
                'validation': obs.validation,
                'source_type': obs.source_type,
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
