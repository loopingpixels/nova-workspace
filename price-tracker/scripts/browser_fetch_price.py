#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

PRICE_PATTERNS = [
    re.compile(r'priceCurrency"\s*:\s*"NZD"\s*,\s*"price"\s*:\s*"([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
    re.compile(r'The best price.*?\$([0-9]+(?:[\.,][0-9]{2})?)', re.I | re.S),
    re.compile(r'"price"\s*:\s*"([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
    re.compile(r'product:price:amount"\s*content="([0-9]+(?:[\.,][0-9]{2})?)"', re.I),
    re.compile(r'\$\s*([1-9][0-9]{1,4}(?:[\.,][0-9]{2})?)'),
]


def parse_price(text: str):
    for pat in PRICE_PATTERNS:
        m = pat.search(text)
        if m:
            try:
                value = float(m.group(1).replace(',', ''))
            except ValueError:
                continue
            if 50 <= value <= 10000:
                return value
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'usage: browser_fetch_price.py <url>'}))
        return 2
    url = sys.argv[1]
    host = urlparse(url).netloc.lower()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until='domcontentloaded', timeout=45000)
        page.wait_for_timeout(4000)
        content = page.content()
        title = page.title()
        browser.close()
    price = parse_price(content)
    print(json.dumps({
        'url': url,
        'host': host,
        'title': title,
        'price': price,
    }))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
