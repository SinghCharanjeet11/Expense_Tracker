// Turns query-string params into a MongoDB filter object.
// Dates arrive as "YYYY-MM-DD" and are stored as UTC midnight, so the
// "to" bound is made inclusive by matching anything before the next day.

function parseDay(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildFilter(query, { includeCategory = true } = {}) {
  const filter = {};

  // Filtering by category
  if (includeCategory && query.category && query.category !== 'All') {
    filter.category = query.category;
  }

  // Date-based query: { date: { $gte: from, $lt: to + 1 day } }
  const from = parseDay(query.from);
  const to = parseDay(query.to);
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lt = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }

  // Case-insensitive text search on title/note
  if (query.search && query.search.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$or = [{ title: re }, { note: re }];
  }

  return filter;
}

module.exports = { buildFilter, parseDay };
