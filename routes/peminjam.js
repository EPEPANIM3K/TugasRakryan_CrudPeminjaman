const express = require('express');
const router = express.Router();
const AlatController = require('../controllers/alatController');

router.get('/alat', AlatController.userPage);

module.exports = router;