const { sbFetch } = require('../services/supabase');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'crownkey_verify_2026';

// GET — Meta webhook verification (one-time setup)
function verify(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Meta webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

// POST — inbound message handler
async function receive(req, res) {
  res.sendStatus(200); // Always ACK immediately

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const msg     = changes?.messages?.[0];
    if (!msg) return;

    const phone = msg.from;
    const text  = msg.type === 'text' ? msg.text?.body?.trim() : `[${msg.type}]`;

    // Log inbound message
    await sbFetch('/rest/v1/outreach_log', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        phone,
        message_body: text,
        direction: 'inbound',
        status: 'received',
        channel: 'whatsapp',
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {});

    // Load active bot rules
    const { data: rules } = await sbFetch(
      '/rest/v1/bot_rules?select=*&active=eq.true'
    ).catch(() => ({ data: [] }));

    if (!rules?.length) return;

    // Match keyword
    const lowerText = text.toLowerCase();
    const matched = rules.find(r => {
      const kw = (r.keyword || '').toLowerCase();
      return r.match === 'exact'
        ? lowerText === kw
        : lowerText.includes(kw);
    });

    if (!matched?.response) return;

    // Send auto-reply via Meta
    const META_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_ID   = process.env.META_PHONE_NUMBER_ID || '810594372145616';
    if (!META_TOKEN) return;

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: matched.response },
      }),
    }).catch(() => {});

  } catch (e) {
    console.error('Webhook handler error:', e.message);
  }
}

module.exports = { verify, receive };
