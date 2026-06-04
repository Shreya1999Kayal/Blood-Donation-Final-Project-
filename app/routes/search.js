const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { searchDonorSchema, searchBloodBankSchema } = require('../utils/validationSchemas');
const searchController = require('../controllers/searchController');

router.get('/donors', auth, validate(searchDonorSchema, 'query'), searchController.searchDonors);
router.get('/bloodbanks', auth, validate(searchBloodBankSchema, 'query'), searchController.searchBloodBanks);

module.exports = router;
