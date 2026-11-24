const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const AlatController = require('../controllers/alatController');
const AdminController = require('../controllers/adminController');
const UsersController = require('../controllers/usersController');

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

router.get('/peminjaman', AdminController.peminjamanPage);
router.post('/peminjaman/:id/status', AdminController.updateStatus);
router.post('/peminjaman/:id/delete', AdminController.removePeminjaman);

router.get('/users', UsersController.usersPage);
router.get('/users/list', UsersController.getUsers);
router.post('/users', UsersController.createUser);
router.post('/users/:id', UsersController.updateUser);
router.post('/users/:id/delete', UsersController.removeUser);

router.get('/aktivitas', AdminController.aktivitasPage);
router.post('/aktivitas/:id/delete', AdminController.removeAktivitas);

module.exports = router;
