# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally (confirmed):
- **Evaluators** of a college project: a teacher or examiner watching a demo on a laptop or projector. They need to see the features work and the MongoDB concepts (CRUD, `$group`/`$sum` aggregation, date queries, sorting/filtering) visibly reflected in the product.
- **The builder as a daily user**: logging their own expenses day to day on a laptop and, as an installed PWA, on a phone. Quick entry and an at-a-glance view of where money goes matter most.

## Product Purpose

Track daily expenses (amount, category, date) and turn them into analytics: totals, category-wise spending, and spending over time. Success: adding an expense takes seconds, and the analytics answer "how much did I spend, and on what?" without scrolling or hunting.

## Positioning

A small, honest full-stack MongoDB app: every number on screen comes from a real aggregation pipeline on the user's own data, not client-side guesswork.

## Operating Context

- Primary demo/use surface is a desktop browser at wide (landscape) widths; the user explicitly wants it to feel like a **website**, not a stretched phone column. Phone use happens through the installed PWA.
- Currency is Indian Rupee (₹), en-IN number formatting.
- Runs locally: Express server on `localhost:3000`, MongoDB at `127.0.0.1:27017`.

## Capabilities and Constraints

- Stack: Node + Express + Mongoose backend; frontend is plain HTML/CSS/JS served statically from `public/` (no build step); charts are hand-drawn SVG. The landing page is `/`, the app is `/app`.
- Features: create/edit/delete expenses (with undo), list all transactions, filter by category and date range, text search, sorting, totals, category breakdown, trend over time, this-month vs last-month.
- Fixed categories: Food, Transport, Shopping, Bills, Entertainment, Health, Education, Other.
- Must be installable as a PWA (manifest + service worker); the API needs the server, so offline mode can only show the app shell and last-known data.
- No authentication or multi-user support.

## Evidence on Hand

- Seeded sample data (~200 expenses over 4 months) via `npm run seed`. No real testimonials, users, or metrics exist; none should be invented.

## Product Principles

1. Entry is instant: adding an expense is always one key or one tap away.
2. Numbers are trustworthy: show the real aggregated figures, formatted for India, never decorative fakes.
3. One screen, one question: each view answers a single question (overview, transactions, analytics) without long scrolling.
4. Demonstrable: features from the brief are easy to show off in a live demo.
