const express = require('express');
const Expense = require('../models/Expense');
const { buildFilter, parseDay } = require('../utils/buildFilter');

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfMonthUTC(year, month) {
  return new Date(Date.UTC(year, month, 1));
}

// Sums amounts for documents matching `match` using $group + $sum
async function sumWhere(match) {
  const [row] = await Expense.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return row ? row.total : 0;
}

// GET /api/stats/summary — total, count, average and largest for the current filters,
// plus this-month vs last-month totals (category filter only).
router.get('/summary', async (req, res, next) => {
  try {
    const filter = buildFilter(req.query);

    const now = new Date();
    const thisMonthStart = startOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth());
    const nextMonthStart = startOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth() + 1);
    const lastMonthStart = startOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth() - 1);
    const categoryOnly = buildFilter({ category: req.query.category });

    const [totals, largest, thisMonth, lastMonth] = await Promise.all([
      Expense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            average: { $avg: '$amount' },
          },
        },
      ]),
      Expense.findOne(filter).sort({ amount: -1 }).lean(),
      sumWhere({ ...categoryOnly, date: { $gte: thisMonthStart, $lt: nextMonthStart } }),
      sumWhere({ ...categoryOnly, date: { $gte: lastMonthStart, $lt: thisMonthStart } }),
    ]);

    const t = totals[0] || { total: 0, count: 0, average: 0 };
    res.json({
      total: t.total,
      count: t.count,
      average: t.average || 0,
      largest: largest ? { title: largest.title, amount: largest.amount, category: largest.category } : null,
      thisMonth,
      lastMonth,
    });
  } catch (err) {
    next(err);
  }
});

// Category-wise spending via $group + $sum. Ignores the category filter so the
// breakdown always shows every category. Shared with /pipeline so the UI can
// show exactly what ran.
function categoryPipeline(query) {
  return [
    { $match: buildFilter(query, { includeCategory: false }) },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        average: { $avg: '$amount' },
      },
    },
    { $sort: { total: -1 } },
    { $project: { _id: 0, category: '$_id', total: 1, count: 1, average: 1 } },
  ];
}

// GET /api/stats/pipeline — the by-category pipeline for the current filters, for display
router.get('/pipeline', (req, res) => {
  const regexAware = (key, value) =>
    value instanceof RegExp ? { $regex: value.source, $options: value.flags } : value;
  res.type('json').send(JSON.stringify(categoryPipeline(req.query), regexAware));
});

// GET /api/stats/by-category
router.get('/by-category', async (req, res, next) => {
  try {
    const rows = await Expense.aggregate(categoryPipeline(req.query));

    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
    res.json(
      rows.map((r) => ({
        ...r,
        percent: grandTotal ? (r.total / grandTotal) * 100 : 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/trend — spending over time, grouped by day (ranges up to ~2 months)
// or by month (longer ranges / all time). Missing buckets are filled with 0.
router.get('/trend', async (req, res, next) => {
  try {
    const filter = buildFilter(req.query);
    const from = parseDay(req.query.from);
    const to = parseDay(req.query.to);

    const span = from ? ((to || new Date()) - from) / DAY_MS : Infinity;
    const unit = span <= 62 ? 'day' : 'month';
    const format = unit === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const rows = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format, date: '$date' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    if (!rows.length && !from) return res.json({ unit, points: [] });

    const byKey = new Map(rows.map((r) => [r._id, r]));
    const firstKey = rows.length ? rows[0]._id : null;
    const lastKey = rows.length ? rows[rows.length - 1]._id : null;

    // Work out the bucket range to fill
    let cursor = from || parseKey(firstKey);
    let end = to || new Date();
    if (lastKey && parseKey(lastKey) > end) end = parseKey(lastKey);
    if (firstKey && parseKey(firstKey) < cursor) cursor = parseKey(firstKey);

    const points = [];
    if (unit === 'day') {
      for (let d = cursor; d <= end; d = new Date(d.getTime() + DAY_MS)) {
        const key = d.toISOString().slice(0, 10);
        const r = byKey.get(key);
        points.push({ key, total: r ? r.total : 0, count: r ? r.count : 0 });
      }
    } else {
      let y = cursor.getUTCFullYear();
      let m = cursor.getUTCMonth();
      const endY = end.getUTCFullYear();
      const endM = end.getUTCMonth();
      while (y < endY || (y === endY && m <= endM)) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const r = byKey.get(key);
        points.push({ key, total: r ? r.total : 0, count: r ? r.count : 0 });
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
      }
    }

    res.json({ unit, points });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/by-weekday — totals per day of the week using $dayOfWeek (1 = Sunday)
router.get('/by-weekday', async (req, res, next) => {
  try {
    const rows = await Expense.aggregate([
      { $match: buildFilter(req.query) },
      {
        $group: {
          _id: { $dayOfWeek: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r]));
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    res.json(
      names.map((day, i) => {
        const r = byDay.get(i + 1);
        return { day, total: r ? r.total : 0, count: r ? r.count : 0 };
      })
    );
  } catch (err) {
    next(err);
  }
});

function parseKey(key) {
  return new Date(key.length === 7 ? `${key}-01T00:00:00.000Z` : `${key}T00:00:00.000Z`);
}

module.exports = router;
