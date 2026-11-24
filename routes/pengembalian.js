const express = require('express');
const router = express.Router();
const pengembalianController = require('../controllers/pengembalianController');
const { requireRole } = require('../middleware/role');
const { requireAuth } = require('../middleware/auth');

// User: ajukan pengembalian untuk peminjaman tertentu
router.post('/user/:peminjamanId', requireRole('user'), pengembalianController.create);

// User: konfirmasi pembayaran denda (tanpa payment gateway)
router.post('/user/:id/pay', requireRole('user'), pengembalianController.pay);

// Petugas: verifikasi pengembalian
router.post('/petugas/:id/verify', requireRole('petugas'), pengembalianController.verify);

// Admin: list & hapus pengembalian
router.get('/admin', requireRole('admin'), pengembalianController.list);
router.delete('/admin/:id', requireRole('admin'), pengembalianController.remove);

// Detail (auth)
router.get('/:id', requireAuth, pengembalianController.detail);

module.exports = router;