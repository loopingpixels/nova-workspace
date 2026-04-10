# Price Tracker

Tracks exact products across selected NZ stores with saved direct product pages, blocked-store awareness, and daily lowest-price monitoring.

## Final workflow
1. Roshan gives a product name and exact model.
2. Find NZ stores selling that exact product.
3. Exclude any store listed in `blocked-stores.json` from the recommended tracking list.
4. Always include comparison sites like PriceSpy / PriceMe when available.
5. Save the selected direct product pages to `trackers.json`.
6. Record the first observed prices as the baseline.
7. Daily cron checks only the saved selected pages.
8. Notify Roshan only when the overall lowest tracked price drops below the previous lowest tracked price.
9. At any time, query tracked items to see the cheapest current tracked price.
10. Tracked items can be updated or removed later.

## Files
- `trackers.json` — tracked products and selected stores
- `blocked-stores.json` — stores to exclude from future recommended tracking lists
- `state/latest.json` — latest observed state per store
- `history/YYYY-MM-DD.jsonl` — append-only daily observations
- `scripts/check_prices.py` — main checker with direct + fallback extraction logic
- `scripts/browser_fetch_price.py` — browser-backed fallback attempt for stubborn stores
- `scripts/run_daily_check.py` — daily alert runner; alerts only on new overall lowest price
- `scripts/add_tracker.py` — add a new tracker entry
- `scripts/list_trackers.py` — query tracked items and current lowest prices
- `scripts/update_tracker_stores.py` — change the selected stores for a tracker
- `scripts/remove_tracker.py` — remove a tracked item

## Rules
- Prefer exact model matches only.
- Ignore marketplace/used listings unless explicitly requested.
- Save and reuse direct product URLs after confirmation.
- Treat blocked stores as excluded from future recommended store lists.
- Use comparison sites as important fallback sources.
- If a store is blocked or unreliable, do not hallucinate a price.
- Notify only on a new global lowest tracked price, not every store-level drop.

## Commands
```bash
python3 price-tracker/scripts/list_trackers.py
python3 price-tracker/scripts/run_daily_check.py
python3 price-tracker/scripts/remove_tracker.py <tracker_id>
python3 price-tracker/scripts/update_tracker_stores.py <tracker_id> <stores_json_file>
```
