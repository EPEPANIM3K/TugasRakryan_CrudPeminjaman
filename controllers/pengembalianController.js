const Pengembalian = require('../models/Pengembalian');
const Peminjaman = require('../models/Peminjaman');
const LogAktivitas = require('../models/LogAktivitas');
const { formatTanggalSaja } = require('../utils/format');

function fail(res, error) {
  console.error('Pengembalian error:', error);
  const status = error && error.status ? error.status : 500;
  res.status(status).json({
    ok: false,
    message: (error && error.message) || 'Terjadi kesalahan pada server.'
  });
}

function success(res, data, message) {
  res.json({ ok: true, data, message });
}

// ---------- USER: Halaman Pengembalian ----------
exports.userPage = async (req, res) => {
  try {
    const user = req.session.user;
    const [myLoans, myPengembalian] = await Promise.all([
      Peminjaman.getForUser(user.id),
      Pengembalian.getAll({ userId: user.id })
    ]);

    const eligibleStatuses = ['Disetujui', 'Dipinjam', 'Terlambat'];
    const blocking = new Set(
      myPengembalian
        .filter(p => p.status_verifikasi !== 'Ditolak')
        .map(p => Number(p.peminjaman_id))
    );
    const eligibleLoans = myLoans.filter(l =>
      eligibleStatuses.includes(l.status) && !blocking.has(Number(l.id))
    );

    const pendingReturns = myPengembalian.filter(p => p.status_verifikasi === 'Menunggu Verifikasi');
    const returnCards = [
      ...eligibleLoans.map(l => ({ type: 'loan', loan: l, pengembalian: null })),
      ...pendingReturns.map(p => ({ type: 'pending', loan: p, pengembalian: p }))
    ];

    const pendingVerify = pendingReturns.length;
    const doneCount = myPengembalian.filter(p => p.status_verifikasi === 'Terverifikasi').length;
    const rejectedCount = myPengembalian.filter(p => p.status_verifikasi === 'Ditolak').length;

    res.render('pages/peminjam/pengembalian', {
      layout: 'layouts/peminjam',
      pageTitle: 'Pengembalian',
      currentPath: '/peminjam/pengembalian',
      eligibleLoans,
      returnCards,
      myPengembalian,
      formatTanggal: formatTanggalSaja,
      stats: { pendingVerify, doneCount, rejectedCount }
    });
  } catch (error) {
    console.error('Halaman pengembalian user error:', error);
    res.status(500).send('Gagal memuat halaman pengembalian.');
  }
};

// ---------- USER: Ajukan Pengembalian ----------
exports.create = async (req, res) => {
  try {
    const user = req.session.user;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const peminjamanId = Number(req.params.peminjamanId || body.peminjamanId || 0);
    if (!peminjamanId) {
      return res.status(400).json({ ok: false, message: 'ID peminjaman wajib diisi.' });
    }

    const existing = await Pengembalian.findByPeminjaman(peminjamanId);
    if (existing && existing.status_verifikasi !== 'Ditolak') {
      return res.status(400).json({ ok: false, message: 'Pengembalian untuk peminjaman ini sudah diajukan.' });
    }

    const newId = await Pengembalian.create(user.id, peminjamanId, {
      kondisi_fisik: body.kondisi_fisik || body.kondisi_alat || null,
      catatan: body.catatan || null
    });

    const created = await Pengembalian.findById(newId);

    await LogAktivitas.record({
      req,
      aksi: 'Ajukan Pengembalian',
      modul: 'Pengembalian',
      referensiTipe: 'pengembalian',
      referensiId: newId,
      deskripsi: 'Mengajukan pengembalian peminjaman #' + peminjamanId +
        ' oleh ' + (user.nama_lengkap || user.username || '-'),
      metadata: { kondisi_fisik: body.kondisi_fisik || body.kondisi_alat || null }
    });

    success(res, created, 'Pengembalian berhasil diajukan.');
  } catch (error) {
    fail(res, error);
  }
};

// ---------- PETUGAS: Verifikasi Pengembalian ----------
exports.verify = async (req, res) => {
  try {
    const petugas = req.session.user;
    if (petugas.role !== 'petugas') {
      return res.status(403).json({ ok: false, message: 'Akses hanya untuk petugas.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const status = body.status || body.status_verifikasi;
    const { kondisi_fisik, catatan, tanggal_kembali_aktual } = body;
    if (status !== 'Terverifikasi' && status !== 'Ditolak') {
      return res.status(400).json({
        ok: false,
        message: 'Status verifikasi harus Terverifikasi atau Ditolak.'
      });
    }

    const verifiedId = await Pengembalian.verify(Number(req.params.id), petugas.id, {
      status, kondisi_fisik, catatan, tanggal_kembali_aktual
    });

    const verified = await Pengembalian.findById(verifiedId);
    await LogAktivitas.record({
      req,
      aksi: 'Verifikasi Pengembalian - ' + status,
      modul: 'Pengembalian',
      referensiTipe: 'pengembalian',
      referensiId: verified.id,
      deskripsi: 'Verifikasi pengembalian ' + verified.kode_pengembalian +
        ' oleh petugas ' + petugas.nama_lengkap + ': ' + status,
      metadata: { status, kondisi_fisik: kondisi_fisik || null, catatan: catatan || null }
    });

    success(res, verified, 'Pengembalian ' + status + '.');
  } catch (error) {
    fail(res, error);
  }
};

// ---------- PETUGAS: Halaman Memantau Pengembalian ----------
exports.petugasPage = async (req, res) => {
  try {
    const items = await Pengembalian.getAll({});
    const pending = items.filter(p => p.status_verifikasi === 'Menunggu Verifikasi').length;
    const verified = items.filter(p => p.status_verifikasi === 'Terverifikasi').length;
    const rejected = items.filter(p => p.status_verifikasi === 'Ditolak').length;

    res.render('pages/petugas/pengembalian', {
      layout: 'layouts/petugas',
      pageTitle: 'Memantau Pengembalian',
      currentPath: '/petugas/pengembalian',
      items,
      stats: { pending, verified, rejected },
      formatTanggal: formatTanggalSaja
    });
  } catch (error) {
    console.error('Halaman pengembalian petugas error:', error);
    res.status(500).send('Gagal memuat halaman pengembalian.');
  }
};

// ---------- ADMIN: Halaman Kelola Pengembalian ----------
exports.adminPage = async (req, res) => {
  try {
    const filters = {
      statusVerifikasi: req.query.status || undefined,
      search: req.query.search || undefined
    };
    const items = await Pengembalian.getAll(filters);
    const stats = {
      pending: items.filter(p => p.status_verifikasi === 'Menunggu Verifikasi').length,
      verified: items.filter(p => p.status_verifikasi === 'Terverifikasi').length,
      rejected: items.filter(p => p.status_verifikasi === 'Ditolak').length,
      total: items.length
    };

    res.render('pages/admin/pengembalian', {
      layout: 'layouts/admin',
      pageTitle: 'Kelola Pengembalian',
      currentPath: '/admin/pengembalian',
      items,
      stats,
      filters,
      formatTanggal: formatTanggalSaja
    });
  } catch (error) {
    console.error('Halaman pengembalian admin error:', error);
    res.status(500).send('Gagal memuat halaman pengembalian.');
  }
};

// ---------- ADMIN: List Pengembalian ----------
exports.list = async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      statusVerifikasi: req.query.status || undefined,
      search: req.query.search || undefined
    };
    const items = await Pengembalian.getAll(filters);
    success(res, items, 'Daftar pengembalian.');
  } catch (error) {
    fail(res, error);
  }
};

// ---------- AUTH: Detail ----------
exports.detail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID wajib diisi.' });
    const item = await Pengembalian.findById(id);
    if (!item) return res.status(404).json({ ok: false, message: 'Pengembalian tidak ditemukan.' });
    success(res, item, 'Detail pengembalian.');
  } catch (error) {
    fail(res, error);
  }
};

// ---------- ADMIN: Hapus Pengembalian ----------
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID wajib diisi.' });
    const removed = await Pengembalian.remove(id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Pengembalian tidak ditemukan.' });
    success(res, null, 'Pengembalian berhasil dihapus.');
  } catch (error) {
    fail(res, error);
  }
};
