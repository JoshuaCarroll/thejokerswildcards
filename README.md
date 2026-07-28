# thejokerswildcards

## Collection Browser

`cards.html` now reads directly from `cards.csv` at the repo root instead of scanning a folder for image pairs.

### CSV fields used by the page

The browser expects these columns in `cards.csv`:

`title`, `year`, `brand`, `set`, `subset`, `player`, `team`, `card_number`, `grade_name`, `grade_number`, `sale_price`, `market_price`, `note`, `front_image`, `back_image`

Only `title`, `front_image`, and `back_image` are required. The rest are used to enrich the card tiles, search, sort, and summary counts when present.

### How it works

- The page fetches `cards.csv` on load and again when you click Refresh CSV.
- Front and back images are hot-loaded directly from the cloud URLs in the CSV.
- Search and sort are client-side, so updating the CSV is enough to refresh the collection view.

### Updating the collection

1. Add or edit rows in `cards.csv`.
2. Make sure `front_image` and `back_image` contain publicly accessible image URLs.
3. Reload `cards.html` or use the Refresh CSV button.