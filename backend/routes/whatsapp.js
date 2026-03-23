const { Router } = require('express');
const { sendTemplate, sendText } = require('../services/whatsappService');
const { sbFetch } = require('../services/supabase');

const router = Router();

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
