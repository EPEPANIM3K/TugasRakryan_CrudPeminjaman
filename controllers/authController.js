const bcrypt = require('bcryptjs');
const User = require('../models/User');

const dashboardByRole = {
  admin: '/admin',
  petugas: '/petugas/peminjaman',
  user: '/peminjam/alat'
};

exports.login = async (req, res) => {
  const identifier = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  try {
    const user = await User.findByEmailOrUsername(identifier);
    const valid = user && user.status_akun === 'Aktif'
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!valid) {
      return res.status(401).json({ ok: false, message: 'Email/username atau kata sandi salah.' });
    }

    await User.updateLastLogin(user.id);
    req.session.user = { id: user.id, nama: user.nama_lengkap, role: user.role };

    res.json({ ok: true, role: user.role, redirect: dashboardByRole[user.role] || '/' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
};