// Fills the database with ~4 months of realistic sample expenses.
// Usage: npm run seed   (this REPLACES all existing expenses)
require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('./models/Expense');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';

const SAMPLES = {
  Food: [['Lunch at office canteen', 120, 260], ['Groceries', 600, 2400], ['Dinner with friends', 800, 2200], ['Coffee', 90, 250], ['Swiggy order', 250, 700]],
  Transport: [['Metro card recharge', 300, 500], ['Uber ride', 150, 550], ['Petrol', 800, 2000], ['Auto rickshaw', 60, 180]],
  Shopping: [['New sneakers', 2500, 5500], ['T-shirts', 700, 1800], ['Amazon order', 400, 3000], ['Headphones', 1500, 4000]],
  Bills: [['Electricity bill', 1200, 2600], ['Mobile recharge', 299, 699], ['Internet bill', 699, 999], ['Rent share', 8000, 8000]],
  Entertainment: [['Movie tickets', 300, 900], ['Netflix subscription', 199, 649], ['Concert', 1500, 3500], ['Gaming top-up', 200, 800]],
  Health: [['Pharmacy', 150, 900], ['Gym membership', 1500, 1500], ['Doctor visit', 500, 1200]],
  Education: [['Online course', 499, 3499], ['Books', 300, 1200], ['Stationery', 80, 400]],
  Other: [['Gift for sister', 800, 2500], ['Haircut', 150, 400], ['Laundry', 200, 500]],
};

// Rough weighting so the category chart looks like real life
const WEIGHTS = { Food: 10, Transport: 6, Shopping: 3, Bills: 2, Entertainment: 3, Health: 2, Education: 2, Other: 2 };

const rand = (min, max) => Math.round(min + Math.random() * (max - min));

function pickCategory() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [cat, w] of Object.entries(WEIGHTS)) {
    if ((r -= w) < 0) return cat;
  }
  return 'Other';
}

function utcDay(daysAgo) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo));
}

async function seed() {
  await mongoose.connect(MONGODB_URI);

  const docs = [];
  for (let daysAgo = 0; daysAgo < 120; daysAgo++) {
    const perDay = rand(0, 3);
    for (let i = 0; i < perDay; i++) {
      const category = pickCategory();
      const options = SAMPLES[category];
      const [title, min, max] = options[rand(0, options.length - 1)];
      docs.push({ title, amount: rand(min, max), category, date: utcDay(daysAgo), note: '' });
    }
  }

  // Monthly rent on the 1st of each month
  for (let m = 0; m < 4; m++) {
    const now = new Date();
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - m, 1));
    docs.push({ title: 'Rent share', amount: 8000, category: 'Bills', date, note: 'Monthly rent' });
  }

  await Expense.deleteMany({});
  await Expense.insertMany(docs);
  console.log(`Seeded ${docs.length} expenses.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
