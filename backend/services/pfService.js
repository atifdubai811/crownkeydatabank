const fetch = require('node-fetch');

const PF_API_KEY    = process.env.PF_API_KEY;
const PF_API_SECRET = process.env.PF_API_SECRET;
const PF_BASE       = 'https://www.propertyfinder.ae/api/v1';

/**
 * Look up a property by permit (P-Number) via Property Finder API.
 * Returns normalized result or null if not found.
 */
async function lookupByPermit(pNumber) {
  if (!PF_API_KEY || !PF_API_SECRET) {
    throw Object.assign(new Error('PF API credentials not configured'), { status: 503 });
  }

  const clean = String(pNumber).replace(/\D/g, '');
  if (!clean) throw Object.assign(new Error('Invalid permit number'), { status: 400 });

  const url = `${PF_BASE}/properties?permit_number=${encodeURIComponent(clean)}&page=1&per_page=10`;

  const res = await fetch(url, {
    headers: {
      'X-Api-Key':    PF_API_KEY,
      'X-Api-Secret': PF_API_SECRET,
      'Accept':       'application/json',
    },
  });

  if (res.status === 404) return { found: false, results: [] };
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`PF API error ${res.status}: ${text.slice(0, 120)}`), { status: res.status });
  }

  const data = await res.json();
  const items = data?.data || data?.properties || data?.results || [];

  return {
    found: items.length > 0,
    total: data?.meta?.total || items.length,
    results: items.map(p => ({
      permit_number:  p.permit_number  || p.permit || clean,
      title:          p.title          || p.name   || '',
      building:       p.building_name  || p.building || '',
      community:      p.community_name || p.community || p.area || '',
      unit_number:    p.unit_number    || p.unit   || '',
      bedrooms:       p.bedrooms       ?? p.beds   ?? null,
      area_sqft:      p.area           || p.size   || null,
      price:          p.price          || null,
      status:         p.status         || '',
      url:            p.url            || p.link   || '',
    })),
  };
}

module.exports = { lookupByPermit };
