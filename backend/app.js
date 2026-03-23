require('dotenv').config();
const express   = require('express');
const cors      = require('cors');

const ownersRouter   = require('./routes/owners');
const recordsRouter  = require('./routes/records');
const campaignsRouter= require('./routes/campaigns');
const pfRouter       = require('./routes/pf');
const webhookRouter  = require('./routes/webhook');
const whatsappRouter = require('./routes/whatsapp');

const app = express();
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/owners',           ownersRouter);
app.use('/api/records',          recordsRouter);
app.use('/api/campaigns',        campaignsRouter);
app.use('/api/whatsapp',         whatsappRouter);  // POST /send-template, /send-message
app.use('/api/pf',               pfRouter);
app.use('/webhook/whatsapp',     webhookRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CrownKey API running on port ${PORT}`));
