require('dotenv').config();
const { Worker } = require('bullmq');
const { connection } = require('../services/queue');
const { sendTemplate } = require('../services/whatsappService');
const { sbFetch } = require('../services/supabase');

console.log('Campaign worker starting...');

const worker = new Worker('campaign', async (job) => {
  const { contacts, templateName, languageCode, campaignName } = job.data;
  let sent = 0, failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    const rec = contacts[i];
    try {
      const result = await sendTemplate(rec.mobile, templateName, languageCode || 'en');

      // Log to outreach_log
      await sbFetch('/rest/v1/outreach_log', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify({
          phone: result.to,
          owner_name: rec.name || '',
          channel: 'whatsapp',
          message_body: `[Template: ${templateName}]`,
          status: 'sent',
          wamid: result.wamid,
          direction: 'outbound',
          created_at: new Date().toISOString(),
        }),
      }).catch(() => {});

      sent++;
    } catch (e) {
      failed++;
      console.error(`Failed ${rec.mobile}: ${e.message}`, e.status ? `(HTTP ${e.status})` : '');
    }

    // Update job progress
    await job.updateProgress(Math.round(((i + 1) / contacts.length) * 100));

    // 1.2s rate limit between messages
    if (i < contacts.length - 1) await new Promise(r => setTimeout(r, 1200));
  }

  // Update campaign record
  await sbFetch(`/rest/v1/campaigns?name=eq.${encodeURIComponent(campaignName)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ status: 'completed', sent_count: sent }),
  }).catch(() => {});

  console.log(`Campaign "${campaignName}" done — sent: ${sent}, failed: ${failed}`);
  return { sent, failed };

}, { connection, concurrency: 1 });

worker.on('completed', job => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed: ${err.message}`));
