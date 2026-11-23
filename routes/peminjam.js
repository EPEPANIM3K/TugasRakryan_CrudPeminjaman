const express = require('express');
const router = express.Router();
const AlatController = require('../controllers/alatController');
const PeminjamController = require('../controllers/peminjamController');

router.get('/alat', AlatController.userPage);

router.get('/riwayat', PeminjamController.riwayatPage);
router.post('/peminjaman', PeminjamController.create);
router.post('/peminjaman/:id/cancel', PeminjamController.cancel);

module.exports = router;