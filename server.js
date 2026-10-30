require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { CATEGORIES } = require('./models/Expense');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// The landing page is public/index.html at "/"; the app itself lives at "/app"
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

app.get('/api/categories', (req, res) => res.json(CATEGORIES));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/stats', require('./routes/stats'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — turns Mongoose validation errors into readable 400s
app.use((err, req, res, next) => {
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ error: message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid value for ${err.path}` });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
    app.listen(PORT, () => console.log(`Expense Tracker running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
