const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const PeminjamanService = require('../services/peminjamanService');
const AlatController = require('../controllers/alatController');

const uploadDir = path.join(__dirname, '..', 'public', 'images', 'alat');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype))
});

router.get('/alat', AlatController.adminPage);
router.post('/alat', upload.single('foto'), AlatController.create);
router.post('/alat/:id', upload.single('foto'), AlatController.update);
router.post('/alat/:id/delete', AlatController.remove);

router.get('/peminjaman', async (req, res) => {
  try {
    const service = new PeminjamanService();
    const stats = await service.countByStatus();
    const totalPengajuan = await service.countTotal();
    const distinctStatuses = await service.getDistinctStatuses();
    const allData = await service.getAll({});
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const tableData = allData.slice(0, limit);

    res.render('pages/admin/peminjaman', {
      pageTitle: 'Kelola Peminjaman',
      stats: {
        totalPengajuan: totalPengajuan || 0,
        menungguPersetujuan: stats['Menunggu Persetujuan'] || 0,
        disetujui: stats['Disetujui'] || 0,
        sedangDipinjam: stats['dipinjam'] || 0,
        selesai: stats['selesai'] || (stats['dikembalikan'] || 0)
      },
      tableData: tableData,
      currentPath: '/admin/peminjaman',
      distinctStatuses: distinctStatuses || []
    });
  } catch (error) {
    console.error('Error fetching peminjaman data:', error);
    res.render('pages/admin/peminjaman', {
      pageTitle: 'Kelola Peminjaman',
      stats: {
        totalPengajuan: 0,
        menungguPersetujuan: 0,
        disetujui: 0,
        sedangDipinjam: 0,
        selesai: 0
      },
      tableData: [],
      currentPath: '/admin/peminjaman',
      distinctStatuses: []
    });
  }
});

module.exports = router;
