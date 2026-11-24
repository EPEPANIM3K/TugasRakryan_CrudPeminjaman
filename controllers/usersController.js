const User = require('../models/User');
const LogAktivitas = require('../models/LogAktivitas');
const { formatTanggal } = require('../utils/format');

function fail(res, error) {
  console.error('User controller error:', error);
  const status = error && error.status ? error.status : 500;
  res.status(status).json({ ok: false, message: (error && error.message) || 'Terjadi kesalahan pada server.' });
}

exports.usersPage = async (req, res) => {
  try {
    const filters = {
      search: String(req.query.search || '').trim(),
      role: String(req.query.role || '').trim(),
      status: String(req.query.status || '').trim()
    };
    const [items, stats] = await Promise.all([User.getAll(filters), User.getStats()]);
    res.render('pages/admin/users', {
      pageTitle: 'Kelola Pengguna',
      currentPath: '/admin/users',
      items,
      stats,
      filters,
      formatTanggal
    });
  } catch (error) {
    console.error('Halaman admin users error:', error);
    res.status(500).send('Gagal memuat halaman pengguna.');
  }
};

exports.getUsers = async (req, res) => {
  try {
    const filters = {
      search: String(req.query.search || '').trim(),
      role: String(req.query.role || '').trim(),
      status: String(req.query.status || '').trim()
    };
    const items = await User.getAll(filters);
    const stats = await User.getStats();
    res.json({ ok: true, items, stats });
  } catch (error) {
    fail(res, error);
  }
};

exports.createUser = async (req, res) => {
  try {
    const data = req.body;
    // Pastikan password minimal 8 karakter jika disediakan
    if (data.password && data.password.length < 8) {
      return res.status(400).json({ ok: false, message: 'Kata sandi minimal 8 karakter.' });
    }
    const created = await User.create(data);
    // Catat log aktivitas
    await LogAktivitas.record({
      req,
      aksi: 'Buat Akun Pengguna',
      modul: 'User',
      referensiTipe: 'users',
      referensiId: created.id,
      deskripsi: `Admin membuat akun baru: ${created.nama_lengkap} (${created.username})`,
      metadata: { role: created.role }
    });
    res.json({ ok: true, data: created });
  } catch (error) {
    fail(res, error);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const actorId = req.session && req.session.user ? req.session.user.id : null;
    const updated = await User.update(id, data, actorId);
    // Catat log aktivitas
    await LogAktivitas.record({
      req,
      aksi: 'Update Akun Pengguna',
      modul: 'User',
      referensiTipe: 'users',
      referensiId: Number(id),
      deskripsi: `Admin memperbarui akun ID ${id}: ${updated.nama_lengkap}`,
      metadata: { role: updated.role }
    });
    res.json({ ok: true, data: updated });
  } catch (error) {
    fail(res, error);
  }
};

exports.removeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.session && req.session.user ? req.session.user.id : null;
    const removed = await User.remove(id, actorId);
    if (!removed) {
      return res.status(404).json({ ok: false, message: 'Pengguna tidak ditemukan.' });
    }
    // Catat log aktivitas
    await LogAktivitas.record({
      req,
      aksi: 'Hapus Akun Pengguna',
      modul: 'User',
      referensiTipe: 'users',
      referensiId: Number(id),
      deskripsi: `Admin menghapus akun ID ${id}`,
      metadata: { role: 'admin' }
    });
    res.json({ ok: true, message: 'Akun pengguna berhasil dihapus.' });
  } catch (error) {
    fail(res, error);
  }
};