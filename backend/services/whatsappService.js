const fetch = require('node-fetch');

const WJ_BASE  = process.env.WJ_BASE  || 'https://crownkey.online/api';
const WJ_UID   = process.env.WJ_UID;
const WJ_TOKEN = process.env.WJ_TOKEN;

function normalizePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0'))  p = '971' + p.slice(1);
  if (!p.startsWith('971') && p.length === 9) p = '971' + p;
  return p;
}

// URL pattern: /api/{uid}/{endpoint}?token={token}
function wjUrl(endpoint) {
  return `${WJ_BASE}/${WJ_UID}/${endpoint}?token=${WJ_TOKEN}`;
}

async function sendTemplate(phone, templateName, languageCode = 'en', components = []) {
  if (!WJ_UID)   throw Object.assign(new Error('WJ_UID not configured'), { status: 503 });
  if (!WJ_TOKEN) throw Object.assign(new Error('WJ_TOKEN not configured'), { status: 503 });

  const to = normalizePhone(phone);
  const url = wjUrl('contact/send-template-message');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      phone_number: to,
      template_name: templateName,
      template_language: languageCode,
      ...(components.length ? { components } : {}),
    }),
  });

  const text = await res.text();
  console.log(`[WhatsJet] send-template → ${res.status}: ${text.slice(0, 200)}`);
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!res.ok) throw Object.assign(new Error(data.message || 'WhatsJet API error'), { status: res.status });
  return { wamid: data.id || data.message_id || null, to };
}

async function sendText(phone, message) {
  if (!WJ_UID)   throw Object.assign(new Error('WJ_UID not configured'), { status: 503 });
  if (!WJ_TOKEN) throw Object.assign(new Error('WJ_TOKEN not configured'), { status: 503 });

  const to = normalizePhone(phone);
  const url = wjUrl('contact/send-message');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ phone_number: to, message }),
  });

  const text = await res.text();
  console.log(`[WhatsJet] send-message → ${res.status}: ${text.slice(0, 200)}`);
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!res.ok) throw Object.assign(new Error(data.message || 'WhatsJet API error'), { status: res.status });
  return { wamid: data.id || data.message_id || null, to };
}

module.exports = { sendTemplate, sendText, normalizePhone };
