# TODO — New Item Table Format

Change item tables app-wide to: **Sr. No. | Product Name | Description | HSN Code | Qty | UOM | Unit Rate (included)**

## Data model (add real `description` field)
- [x] Add `description TEXT` column to `deal_item` in `db/schema.sql`
- [x] Seed meaningful descriptions for demo items in `db/seed.js`
- [x] Update `server.js` `/api/order` to persist `description` on each item

## Sauda Create (item entry form)
- [x] Update table header in `public/sauda-create.html`
- [x] Update `public/js/sauda-create.js`:
  - [x] `addItemRow`: add Sr.No cell + Description input
  - [x] renumber Sr.No on add/remove
  - [x] `saveDraft` / `restoreDraft`: persist description
  - [x] submit handler: include description

## Display tables
- [x] `public/bill-generation.html` + `public/js/bill-generation.js`
- [x] `public/js/bill-ack.js`
- [x] `public/js/po-confirm.js`

## Verify
- [x] Syntax-check JS files (`node --check`) — all pass
- [x] Re-seed DB — new `description` column populated correctly
- [x] Live API returns `description` for items
