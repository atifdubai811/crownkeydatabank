const { sbFetch } = require('./supabase');

const SELECT_FIELDS = 'id,name,mobile,secondary_mobile,email,building,unit_number,area_community,p_number,source_year,rooms,record_type,flag';

function buildFilters({ community, building, year, record_type, phone, email }) {
  let q = '';
  if (community === '__blank__') q += '&area_community=eq.';
  else if (community) q += `&area_community=ilike.*${encodeURIComponent(community)}*`;
  if (building)    q += `&building=ilike.*${encodeURIComponent(building)}*`;
  if (year)        q += `&source_year=eq.${encodeURIComponent(year)}`;
  if (record_type) q += `&record_type=eq.${encodeURIComponent(record_type)}`;
  if (phone === 'with')    q += '&mobile=neq.&mobile=not.like.INVALID*';
  if (phone === 'without') q += '&mobile=eq.';
  if (email === 'with')    q += '&email=neq.';
  return q;
}

async function countRecords(filters) {
  const f = buildFilters(filters);
  const { count } = await sbFetch(
    `/rest/v1/records?select=id${f}`,
    { prefer: 'count=exact', headers: { Range: '0-0' } }
  );
  return count ?? 0;
}

async function listRecords({ limit, offset, ...filters }) {
  const f = buildFilters(filters);
  const { data } = await sbFetch(
    `/rest/v1/records?select=${SELECT_FIELDS}${f}&order=source_year.desc,id.desc`,
    { headers: { Range: `${offset}-${offset + limit - 1}` } }
  );
  return data ?? [];
}

const VALID_COLS = new Set(['name','mobile','secondary_mobile','email','building',
  'unit_number','area_community','p_number','source_year','rooms','record_type','flag','source_file']);

async function insertRecords(rows) {
  // Strip any columns not in the Supabase schema
  const clean = rows.map(row => {
    const r = {};
    for (const [k, v] of Object.entries(row)) {
      if (VALID_COLS.has(k)) r[k] = v;
    }
    return r;
  });
  const { data } = await sbFetch('/rest/v1/records', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(clean),
  });
  return data;
}

async function getRecordsByName(name) {
  const { data } = await sbFetch(
    `/rest/v1/records?select=*&name=eq.${encodeURIComponent(name)}&limit=50`
  );
  return data ?? [];
}

module.exports = { countRecords, listRecords, insertRecords, getRecordsByName };
