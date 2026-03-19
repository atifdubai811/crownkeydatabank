const { Router } = require('express');
const { lookup } = require('../controllers/pfController');

const router = Router();

router.get('/lookup', lookup);

module.exports = router;
