const { sbFetch } = require('./supabase');

/**
 * Build filter query string from validated params.
 */
function buildFilters({ community, building, year }) {
  let q = '';
  if (community) q += `&area_community=ilike.*${encodeURIComponent(community)}*`;
  if (building)  q += `&building=ilike.*${encodeURIComponent(building)}*`;
  if (year)      q += `&source_year=eq.${encodeURIComponent(year)}`;
  return q;
}

/**
 * Count owners matching optional filters.
 */
async function countOwners(filters) {
  const f = buildFilters(filters);
  const { count } = await sbFetch(
    `/rest/v1/owners?select=id${f}`,
    { prefer: 'count=exact', headers: { Range: '0-0' } }
  );
  return count ?? 0;
}

/**
 * List owners with pagination and optional filters.
 * Returns only fields needed for campaigns.
 */
async function listOwners({ limit, offset, ...filters }) {
  const f = buildFilters(filters);
  const rangeStart = offset;
  const rangeEnd   = offset + limit - 1;

  const { data } = await sbFetch(
    `/rest/v1/owners?select=id,name,mobile,secondary_mobile,email,building,area_community,source_year,lead_score,lead_status${f}&order=lead_score.desc,id.desc`,
    { headers: { Range: `${rangeStart}-${rangeEnd}` } }
  );
  return data ?? [];
}

module.exports = { countOwners, listOwners };
