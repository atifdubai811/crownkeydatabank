require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const ownersRouter = require('./routes/owners');
const pfRouter     = require('./routes/pf');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/owners', ownersRouter);
app.use('/api/pf',     pfRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CrownKey API running on port ${PORT}`));
