# Ledger — Expense Tracker with Analytics

A small full-stack expense tracker: **Node.js + Express + MongoDB (Mongoose)** on the backend, plain HTML/CSS/JS on the frontend (hand-drawn SVG charts, no build step). Installable as a PWA.

## Run it

Requires Node 18+ and a running MongoDB (default `mongodb://127.0.0.1:27017`).

```bash
npm install
npm run seed     # optional: loads ~4 months of sample data (replaces existing expenses)
npm start        # or: npm run dev  (auto-restart on changes)
```

Open http://localhost:3000 for the landing page, or go straight to the app at http://localhost:3000/app. To use a different database, copy `.env.example` to `.env` and edit `MONGODB_URI`.

## Features

- Three screens: **Overview** (station-board total, category lines, daily chart, recent entries), **Transactions** (full list with search and sort), **Analytics** (monthly chart, weekday pattern, category table, and the live MongoDB pipeline)
- Add, edit and delete expenses from a side drawer (press **N** anywhere), with undo for deletes
- Filter every screen by category (the "lines" in the sidebar) and by date range (7D / 30D / 90D / month / year / all / custom)
- Total, average, largest expense, and this month vs last month
- **Landing page** at `/` with a piggy-bank hero image whose glass card shows this month's real total, live figures from the API, the app's screens and a metro map of category shares
- **3D touches in the app:** split-flap board digits, a floating ₹ coin, board tilt, and screen entrances (all off under reduced motion)
- **PWA:** install from the sidebar's *Install app* button (Chrome/Edge). The app shell works offline and shows the last data it loaded; saving needs the server.

See `DESIGN.md` for the visual system.

## Project structure

```
server.js              Express app, static files, /app route, error handling, Mongo connection
models/Expense.js      Mongoose schema + validation + indexes
routes/expenses.js     CRUD endpoints
routes/stats.js        Aggregation endpoints (summary, by-category, trend)
utils/buildFilter.js   Query params -> MongoDB filter (category, dates, search)
seed.js                Sample data generator
public/                Landing page (index.html, landing.css, landing.js, hero.webp, shots/), app (app.html, styles.css, app.js),
                       PWA (manifest.webmanifest, sw.js, icons/), self-hosted Anek fonts
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/expenses` | List expenses. Query: `category`, `from`, `to` (YYYY-MM-DD), `search`, `sort` (`date`/`amount`/`title`), `order` (`asc`/`desc`) |
| GET | `/api/expenses/:id` | Get one expense |
| POST | `/api/expenses` | Create `{ title, amount, category, date, note? }` |
| PUT | `/api/expenses/:id` | Update an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET | `/api/stats/summary` | Total, count, average, largest, this/last month |
| GET | `/api/stats/by-category` | Total and count per category with percentages |
| GET | `/api/stats/trend` | Totals per day (≤ 62-day range) or per month |
| GET | `/api/stats/by-weekday` | Totals per day of week (`$dayOfWeek`) |
| GET | `/api/stats/pipeline` | The by-category pipeline for the current filters (shown on Analytics) |
| GET | `/api/categories` | Allowed categories |

## MongoDB concepts demonstrated

| Concept | Where |
| --- | --- |
| **CRUD** | `routes/expenses.js` — `create`, `find`, `findById`, `findByIdAndUpdate` (with `runValidators`), `findByIdAndDelete` |
| **Aggregation with `$group` + `$sum`** | `routes/stats.js` — total spend (`_id: null`), per-category totals (`_id: '$category'`), `$avg`, counts via `{ $sum: 1 }` |
| **Date-based queries** | `utils/buildFilter.js` — `{ date: { $gte: from, $lt: to + 1 day } }`; month comparisons in `/summary`; `$dateToString` grouping in `/trend`; `$dayOfWeek` in `/by-weekday` |
| **Sorting & filtering** | `.sort({ [field]: dir })` on the list, `$sort` in pipelines, `$match` on category/date/regex search |
| **Schema validation & indexes** | `models/Expense.js` — required fields, `min`, `enum`, indexes on `date` and `{ category, date }` |

Example pipeline (category-wise spending):

```js
Expense.aggregate([
  { $match: { date: { $gte: from, $lt: to } } },
  { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  { $sort: { total: -1 } },
]);
```
