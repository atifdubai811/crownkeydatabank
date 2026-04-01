const { listCampaigns, createCampaign } = require('../services/campaignService');
const { campaignQueue } = require('../services/queue');
const { sbFetch } = require('../services/supabase');

async function getCampaigns(req, res, next) {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);
    const data = await listCampaigns({ limit, offset });
    res.json({ count: data.length, data });
  } catch (e) { next(e); }
}

async function launchCampaign(req, res, next) {
  try {
    const { contacts, templateName, languageCode, campaignName } = req.body;

    if (!contacts?.length)  return res.status(400).json({ error: 'contacts array required' });
    if (!templateName)      return res.status(400).json({ error: 'templateName required' });
    if (!campaignName)      return res.status(400).json({ error: 'campaignName required' });

    // Save campaign record
    await createCampaign({
      name: campaignName,
      channel: 'whatsapp',
      status: 'queued',
      total_recipients: contacts.length,
      custom_message: `[Template: ${templateName}]`,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    // Enqueue job
    const job = await campaignQueue.add('send', {
      contacts, templateName, languageCode: languageCode || 'en_US', campaignName,
    }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    res.json({ success: true, jobId: job.id, queued: contacts.length });
  } catch (e) { next(e); }
}

async function getCampaignStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = await campaignQueue.getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const state = await job.getState();
    res.json({ jobId, state, progress: job.progress, result: job.returnvalue });
  } catch (e) { next(e); }
}

module.exports = { getCampaigns, launchCampaign, getCampaignStatus };
