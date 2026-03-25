const { countRecords, listRecords, insertRecords, getRecordsByName } = require('../services/recordsService');
const XLSX = require('xlsx');

function parseFilters(query) {
  const { community, building, year, record_type, phone, email } = query;
  if (year && !/^\d{4}$/.test(year)) return { error: 'year must be 4 digits' };
  return { filters: {
    community:   community?.trim()   || '',
    building:    building?.trim()    || '',
    year:        year                || '',
    record_type: record_type?.trim() || '',
    phone:       phone               || '',
    email:       email               || '',
  }};
}

async function getCount(req, res, next) {
  try {
    const { filters, error } = parseFilters(req.query);
    if (error) return res.status(400).json({ error });
    res.json({ count: await countRecords(filters) });
  } catch (e) { next(e); }
}

async function getList(req, res, next) {
  try {
    const { filters, error } = parseFilters(req.query);
    if (error) return res.status(400).json({ error });
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 1000);
    const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
    if (isNaN(limit) || isNaN(offset)) return res.status(400).json({ error: 'limit/offset must be integers' });
    const data = await listRecords({ limit, offset, ...filters });
    res.json({ count: data.length, offset, limit, data });
  } catch (e) { next(e); }
}

async function getByName(req, res, next) {
  try {
    const name = (req.query.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name param required' });
    const data = await getRecordsByName(name);
    res.json({ count: data.length, data });
  } catch (e) { next(e); }
}

async function uploadRecords(req, res, next) {
  try {
    // Accept either multipart file upload OR JSON body with rows array
    if (req.file) {
      // File upload path
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', dense: true });
      let rows = [];
      for (const sname of wb.SheetNames) {
        const ws = wb.Sheets[sname];
        if (!ws || !ws['!ref']) continue;
        const sheet = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (sheet.length > rows.length) rows = sheet;
      }
      rows = rows.filter(r => Object.values(r).some(v => String(v || '').trim()));
      if (!rows.length) return res.status(400).json({ error: 'No valid rows found in file' });

      const COL_MAP = {
        'owner name':'name','phone':'mobile','phone 1':'mobile',
        'phone 2':'secondary_mobile','unit number':'unit_number',
        'community':'area_community','p-number':'p_number',
        'source year':'source_year','year':'source_year',
        'record type':'record_type','type':'record_type','category':'record_type',
        'lead type':'record_type','owner type':'record_type',
      };
      const VALID = ['name','mobile','secondary_mobile','email','building','unit_number',
                     'area_community','p_number','source_year','rooms','record_type','flag','source_file'];

      const clean = rows.map(rec => {
        const r = {};
        for (const [k, v] of Object.entries(rec)) {
          const key = COL_MAP[k.toLowerCase().trim()] || k.toLowerCase().trim().replace(/\s+/g,'_');
          if (VALID.includes(key)) r[key] = String(v || '').trim();
        }
        if (!r.record_type) r.record_type = 'Owner';
        if (!r.source_year || r.source_year === '0') r.source_year = new Date().getFullYear();
        if (!r.source_file) r.source_file = req.file.originalname;
        return r;
      }).filter(r => r.name && r.name.length > 1);

      if (!clean.length) return res.status(400).json({ error: 'No valid records after normalization' });

      let inserted = 0;
      for (let i = 0; i < clean.length; i += 100) {
        await insertRecords(clean.slice(i, i + 100));
        inserted += Math.min(100, clean.length - i);
      }
      return res.json({ success: true, inserted, total: clean.length });
    }

    // JSON rows path (from frontend sbInsertBatch)
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'rows array required' });
    }
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      await insertRecords(rows.slice(i, i + 100));
      inserted += Math.min(100, rows.length - i);
    }
    res.json({ success: true, inserted });

  } catch (e) { next(e); }
}

module.exports = { getCount, getList, getByName, uploadRecords };
