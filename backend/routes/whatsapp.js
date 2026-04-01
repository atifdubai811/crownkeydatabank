const { Router } = require('express');
const { sendTemplate, sendText } = require('../services/whatsappService');
const { sbFetch } = require('../services/supabase');
const supabase = require('../services/supabaseClient');

const router = Router();

// GET /api/whatsapp/templates — fetch synced templates from Supabase
router.get('/templates', async (req, res, next) => {
  try {
    const { data } = await sbFetch('/rest/v1/templates?select=*&order=name');
    res.json({ data: data || [] });
  } catch (e) { next(e); }
});

// POST /api/whatsapp/sync-templates — pull from Meta Graph API and upsert to Supabase
router.post('/sync-templates', async (req, res, next) => {
  try {
    const wabaId = process.env.META_WABA_ID;
    const token  = process.env.META_ACCESS_TOKEN;
    if (!wabaId || !token) {
      return res.status(400).json({ error: 'META_WABA_ID and META_ACCESS_TOKEN not set in .env' });
    }

    // Fetch templates from Meta
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?fields=name,status,category,language,components&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      const err = await metaRes.text();
      return res.status(502).json({ error: `Meta API error: ${err.slice(0, 200)}` });
    }
    const metaData = await metaRes.json();
    const templates = metaData.data || [];

    if (!templates.length) {
      return res.json({ success: true, synced: 0, total: 0, message: 'No templates returned from Meta' });
    }

    // Build upsert payload
    const rows = templates.map(t => {
      const bodyComp   = t.components?.find(c => c.type === 'BODY');
      const headerComp = t.components?.find(c => c.type === 'HEADER');
      const btnComp    = t.components?.find(c => c.type === 'BUTTONS');
      return {
        name:        t.name,
        meta_id:     t.id     || null,
        status:      t.status || null,
        category:    t.category || null,
        language:    t.language || null,
        body_text:   bodyComp?.text    || null,
        preview:     (bodyComp?.text || '').slice(0, 120) || null,
        header_type: headerComp?.format || null,
        header_text: headerComp?.text   || null,
        buttons:     btnComp?.buttons   || [],
        channel:     'whatsapp',
      };
    });

    // Upsert all at once — conflict on name
    const { data, error } = await supabase
      .from('templates')
      .upsert(rows, { onConflict: 'name', ignoreDuplicates: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column')) {
        return res.status(500).json({ error: 'Database schema is outdated. Please contact your administrator to apply the latest migrations.' });
      }
      return res.status(500).json({ error: 'Failed to sync templates. Please try again later.' });
    }

    res.json({ success: true, synced: templates.length, total: templates.length });
  } catch (e) { next(e); }
});

// GET /api/whatsapp/inbox — fetch inbound messages from outreach_log
router.get('/inbox', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const filter = req.query.filter || 'all';
    let path = `/rest/v1/outreach_log?select=*&direction=eq.inbound&order=created_at.desc`;
    if (filter === 'stop')       path += '&message_body=ilike.*STOP*';
    if (filter === 'interested') path += '&message_body=ilike.*yes*';
    path += `&limit=${limit}`;
    const { data } = await sbFetch(path);
    res.json({ data: data || [] });
  } catch (e) { next(e); }
});

// POST /api/whatsapp/send-template
router.post('/send-template', async (req, res, next) => {
  try {
    const { phone, templateName, languageCode = 'en', components = [], ownerName = '' } = req.body;
    if (!phone)        return res.status(400).json({ error: 'phone required' });
    if (!templateName) return res.status(400).json({ error: 'templateName required' });

    const result = await sendTemplate(phone, templateName, languageCode, components);

    // Log to outreach_log (non-blocking)
    sbFetch('/rest/v1/outreach_log', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        phone: result.to,
        owner_name: ownerName,
        channel: 'whatsapp',
        message_body: `[Template: ${templateName}]`,
        status: 'sent',
        wamid: result.wamid,
        direction: 'outbound',
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {});

    res.json({ success: true, wamid: result.wamid, to: result.to });
  } catch (e) { next(e); }
});

// POST /api/whatsapp/send-message
router.post('/send-message', async (req, res, next) => {
  try {
    const { phone, message, ownerName = '' } = req.body;
    if (!phone)   return res.status(400).json({ error: 'phone required' });
    if (!message) return res.status(400).json({ error: 'message required' });

    const result = await sendText(phone, message);

    sbFetch('/rest/v1/outreach_log', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        phone: result.to,
        owner_name: ownerName,
        channel: 'whatsapp',
        message_body: message,
        status: 'sent',
        wamid: result.wamid,
        direction: 'outbound',
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {});

    res.json({ success: true, wamid: result.wamid, to: result.to });
  } catch (e) { next(e); }
});

module.exports = router;
