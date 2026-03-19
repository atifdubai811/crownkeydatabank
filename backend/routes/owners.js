const { Router } = require('express');
const { getCount, getList } = require('../controllers/ownersController');

const router = Router();

router.get('/count', getCount);
router.get('/list',  getList);

module.exports = router;
