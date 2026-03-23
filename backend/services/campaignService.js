const { sbFetch } = require('./supabase');

async function listCampaigns({ limit = 20, offset = 0 } = {}) {
  const { data } = await sbFetch(
    `/rest/v1/campaigns?select=*&order=created_at.desc`,
    { headers: { Range: `${offset}-${offset + limit - 1}` } }
  );
  return data ?? [];
}

async function createCampaign(payload) {
  const { data } = await sbFetch('/rest/v1/campaigns', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify(payload),
  });
  return data;
}

async function updateCampaign(name, payload) {
  const { data } = await sbFetch(
    `/rest/v1/campaigns?name=eq.${encodeURIComponent(name)}`,
    { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(payload) }
  );
  return data;
}

module.exports = { listCampaigns, createCampaign, updateCampaign };
