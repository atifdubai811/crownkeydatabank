const { countOwners, listOwners } = require('../services/ownersService');

/**
 * Validate and parse shared filter params.
 */
function parseFilters(query) {
  const { community, building, year } = query;

  if (year !== undefined && !/^\d{4}$/.test(year)) {
    return { error: 'year must be a 4-digit number' };
  }

  return {
    filters: {
      community: community?.trim() || '',
      building:  building?.trim()  || '',
      year:      year               || '',
    },
  };
}

/**
 * GET /api/owners/count
 * Query params: community, building, year
 */
async function getCount(req, res, next) {
  try {
    const { filters, error } = parseFilters(req.query);
    if (error) return res.status(400).json({ error });

    const count = await countOwners(filters);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/owners/list
 * Query params: community, building, year, limit (default 100, max 500), offset (default 0)
 */
async function getList(req, res, next) {
  try {
    const { filters, error } = parseFilters(req.query);
    if (error) return res.status(400).json({ error });

    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);

    if (isNaN(limit) || isNaN(offset)) {
      return res.status(400).json({ error: 'limit and offset must be integers' });
    }

    const owners = await listOwners({ limit, offset, ...filters });
    res.json({ count: owners.length, offset, limit, data: owners });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCount, getList };
