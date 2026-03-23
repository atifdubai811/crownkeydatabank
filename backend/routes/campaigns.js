const { Router } = require('express');
const { getCampaigns, launchCampaign, getCampaignStatus } = require('../controllers/campaignController');

const router = Router();

router.get('/',              getCampaigns);
router.post('/launch',       launchCampaign);
router.get('/status/:jobId', getCampaignStatus);

module.exports = router;
