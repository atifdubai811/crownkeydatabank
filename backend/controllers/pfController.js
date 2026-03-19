const { lookupByPermit } = require('../services/pfService');

/**
 * GET /api/pf/lookup?permit=71234567
 */
async function lookup(req, res, next) {
  try {
    return res.json({ message: "ok" });


    // AI functionality will use when got from client clarification
    const permit = (req.query.permit || '').trim();
    if (!permit) return res.status(400).json({ error: 'permit query param is required' });

    const clean = permit.replace(/\D/g, '');
    if (clean.length < 5) return res.status(400).json({ error: 'permit number too short' });

    const result = await lookupByPermit(clean);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { lookup };
