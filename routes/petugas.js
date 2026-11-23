const express = require('express');
const router = express.Router();
const PetugasController = require('../controllers/petugasController');

router.get('/peminjaman', PetugasController.peminjamanPage);
router.post('/peminjaman/:id/approve', PetugasController.approve);
router.post('/peminjaman/:id/reject', PetugasController.reject);

module.exports = router;