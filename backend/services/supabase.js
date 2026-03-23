const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
}

/**
 * Minimal Supabase REST client using service key.
 * @param {string} path  - e.g. '/rest/v1/owners?select=*'
 * @param {object} opts  - fetch options (method, body, headers)
 */
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: opts.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || '',
      ...(opts.headers || {}),
    },
    body: opts.body || undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `Supabase error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  // Return { data, count } — count only present when Prefer: count=exact
  const contentRange = res.headers.get('content-range');
  const count = contentRange ? parseInt(contentRange.split('/')[1], 10) : null;

  // 204 No Content or empty body (return=minimal) — nothing to parse
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return { data: null, count };
  }
  const text = await res.text();
  if (!text) return { data: null, count };
  const data = JSON.parse(text);
  return { data, count };
}

module.exports = { sbFetch };
