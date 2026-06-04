const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const exportController = require('../controllers/exportController');

router.get('/my-data', auth, exportController.exportMyData);

module.exports = router;
