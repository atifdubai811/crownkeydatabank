const { Router } = require('express');
const multer = require('multer');
const { getCount, getList, getByName, uploadRecords } = require('../controllers/recordsController');

const router  = Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/count',    getCount);
router.get('/list',     getList);
router.get('/by-name',  getByName);
router.post('/upload',  upload.single('file'), uploadRecords);

module.exports = router;
