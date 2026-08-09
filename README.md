# Kranti — Prototype v0.2

A working prototype of the Kranti bill-tracking pipeline: HTML/CSS/JS frontend,
Node/Express backend, SQLite database.

## What's new in v0.2

- **Order → multi-buyer split.** One Order (`ORD-000001`) can hold N independent
  buyer legs. Each leg gets its own Purchase Order, its own buyer link, its own
  Bill and OTP cycle — but all share the Order ID for traceability.
- **4-ID system**: `order_id`, `po_id`, `bill_id` (invoice_ack_rec), and a reserved
  `parent_id`/branch slot for the (still-deferred) dispute-branching module.
- **Hard 25-minute expiry** on buyer confirmation links. Past the window, the link
  is dead — the seller has to hit **Resend** to reissue it.
- **Buyer flow now genuinely requires no login** — two new public pages:
  - `po-confirm.html?po=<id>` — Verify / Deny / Ignore, with a live countdown
  - `bill-ack.html?po=<id>` — OTP trigger + verification + e-stamp display
  This fixes a real gap in v0.1, where OTP verification incorrectly lived behind
  the seller's authenticated shell.
- **Bill Generation** is now a seller-only management view: an OCR-adapter stub
  (upload a scan, get a mocked cross-check pass), invoice number + date entry
  (auto-suggested, sequential), and a generated buyer link to copy/share.
- **Distribution stub** — on OTP success, the system picks email vs SMS per
  recipient (buyer/agent/transporter) based on what's on file, and records it.
- **Lifting window** — `lifting_date` → `last_lifting_date`, not a single date.
- **Payment ratio auto-calculate** — enter Advance/Ratio A %, the Credit/Ratio B %
  fills in automatically (and vice versa isn't wired since only one direction is
  needed, per the form).
- **Email field** added to Buyer / Agent / Transporter, all CRUD'd from Profile.
- **GSTIN always uppercase**, enforced client- and server-side.
- Removed the decorative menu bar and window `_ ▢ X` controls — they did nothing.

## Pages

1. **Login** — Apple-style minimal design
2. **Subscribers** — users with access/permissions on this subscription
3. **Profile** — full CRUD: Seller Details, Buyers, Agents, Transporters, T&C, Best Buys, Note
4. **Advanced Dashboard** — deal stats, status breakdown, buyer volume, recent activity
5. **Sauda Create** — one Order, add as many independent buyer legs as needed
6. **Purchase Orders** — draft deals awaiting a PO, live expiry countdowns, resend, copy buyer link
7. **Bill Generation** (seller view) — OCR stub, invoice prep, buyer link, status mirror
8. **po-confirm.html** (public, no login) — buyer's PO verification screen
9. **bill-ack.html** (public, no login) — buyer's OTP + e-stamp screen

Everything except login uses the "old-school enterprise software" look (beveled
3D chrome, title bars, dense tables). Login uses a clean Apple-style design.

## Run it

```
npm install       # or: bun install
npm run seed      # or: bun run seed  — (re)creates and seeds the SQLite database
npm start         # or: bun run dev   — dev uses --watch for auto-reload
```

Then open **http://localhost:4173/login.html**

## Demo login
- Email: `adnan@xyz.com`
- Password: `Password@123`

(pre-filled on the login screen)

## Demo data worth knowing about

- **PO #1** (Order `ORD-000001`, Om Traders) is seeded fresh — its 25-minute
  expiry window starts counting from the moment you run the seed script. Good
  for testing the hard-expiry behavior live.
- **PO #4** (Order `ORD-000004`, Om Traders, second leg) is seeded already past
  its window — shows `expired` status and the Resend button immediately.
- **Order `ORD-000004`** itself is the multi-buyer demo — two buyer legs
  (Ganesh Agro Traders, verified; Om Traders, pending) under one order.
- Buyers/agents/transporters have a mix of emails present/absent, so the
  distribution stub demonstrably falls back to SMS where there's no email on file.

## Notes on this prototype

- OTP is faked for demo purposes — the code is returned directly in the API
  response and shown on-screen instead of being sent by real SMS.
- OCR cross-check is a UI stub (any uploaded image "passes") — no real OCR call.
- E-stamp is a placeholder reference string, not a real government e-stamping integration.
- Distribution doesn't actually send email/SMS — it records what channel *would*
  be used per recipient, and a timestamp.
- Dispute/Damage Report flow is still a stub button — deferred module.
- Data resets every time you run `npm run seed` / `bun run seed`.
