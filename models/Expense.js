const mongoose = require('mongoose');

const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Education',
  'Other',
];

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [80, 'Title must be 80 characters or fewer'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: '{VALUE} is not a valid category' },
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [200, 'Note must be 200 characters or fewer'],
      default: '',
    },
  },
  { timestamps: true }
);

// Speeds up the most common queries: filter by category, sort/range by date.
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.CATEGORIES = CATEGORIES;
