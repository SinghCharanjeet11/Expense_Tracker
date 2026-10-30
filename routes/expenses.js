const express = require('express');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const { buildFilter } = require('../utils/buildFilter');

const router = express.Router();

const SORT_FIELDS = { date: 'date', amount: 'amount', title: 'title' };

function pickFields(body) {
  const { title, amount, category, date, note } = body;
  return { title, amount, category, date, note };
}

function checkId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid expense id' });
  }
  next();
}

// READ all — supports ?category=&from=&to=&search=&sort=date|amount|title&order=asc|desc
router.get('/', async (req, res, next) => {
  try {
    const filter = buildFilter(req.query);
    const field = SORT_FIELDS[req.query.sort] || 'date';
    const direction = req.query.order === 'asc' ? 1 : -1;

    // Sorting: primary field, then newest-created as a tie-breaker
    const expenses = await Expense.find(filter)
      .sort({ [field]: direction, createdAt: -1 })
      .lean();

    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// READ one
router.get('/:id', checkId, async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id).lean();
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

// CREATE
router.post('/', async (req, res, next) => {
  try {
    const expense = await Expense.create(pickFields(req.body));
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

// UPDATE
router.put('/:id', checkId, async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, pickFields(req.body), {
      new: true,
      runValidators: true,
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete('/:id', checkId, async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted', id: expense._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
