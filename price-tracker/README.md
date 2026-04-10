# Price Tracker

Tracks exact products across selected NZ stores.

## Workflow
1. Capture a product request with exact model number.
2. Save chosen store URLs to `trackers.json`.
3. Run the daily checker to fetch current prices and stock state.
4. Log changes into `history/` and alert only on meaningful changes.

## Files
- `trackers.json` — tracked products and selected stores
- `state/latest.json` — latest observed state per store
- `history/YYYY-MM-DD.jsonl` — append-only daily observations
- `scripts/check_prices.py` — daily checker
- `scripts/run_daily_check.py` — alert-friendly wrapper for cron
- `scripts/add_tracker.py` — add a new tracker entry
- `example-stores.json` — sample store list format

## Daily run
```bash
python3 price-tracker/scripts/run_daily_check.py
```

## Add tracker
```bash
python3 price-tracker/scripts/add_tracker.py "Sony WH-1000XM5 Headphones" "WH-1000XM5" 499 ./price-tracker/example-stores.json
```

## Notes
- Prefer exact model matches only.
- Ignore marketplace/used listings unless explicitly requested.
- Mark a store as blocked if scraping becomes unreliable.
