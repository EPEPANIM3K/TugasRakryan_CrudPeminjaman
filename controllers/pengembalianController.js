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

function isPaid(item) {
  return Boolean(item) && (Number(item.denda_dibayar) === 1 || item.status_denda === 'Lunas');
}

// Status efektif yang ditampilkan di UI (Bayar Denda tidak disimpan di status_verifikasi).
function effectiveStatus(item) {
  if (!item) return 'Menunggu Verifikasi';
  if (item.status_verifikasi === 'Terverifikasi') return 'Terverifikasi';
  if (item.status_verifikasi === 'Ditolak') return 'Ditolak';
  if (item.status_denda === 'Belum Lunas' && Number(item.denda) > 0) return 'Bayar Denda';
  return 'Menunggu Verifikasi';
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

    const penaltyReturns = myPengembalian.filter(p => effectiveStatus(p) === 'Bayar Denda');
    const pendingReturns = myPengembalian.filter(p => effectiveStatus(p) === 'Menunggu Verifikasi' && !isPaid(p));
    const paidReturns = myPengembalian.filter(p => effectiveStatus(p) === 'Menunggu Verifikasi' && isPaid(p));

    const returnCards = [
      ...eligibleLoans.map(l => ({ type: 'loan', loan: l, pengembalian: null })),
      ...penaltyReturns.map(p => ({ type: 'penalty', loan: p, pengembalian: p })),
      ...pendingReturns.map(p => ({ type: 'pending', loan: p, pengembalian: p })),
      ...paidReturns.map(p => ({ type: 'paid', loan: p, pengembalian: p }))
    ];

    const stats = {
      pendingVerify: pendingReturns.length + paidReturns.length,
      penaltyCount: penaltyReturns.length,
      paidCount: paidReturns.length,
      doneCount: myPengembalian.filter(p => effectiveStatus(p) === 'Terverifikasi').length,
      rejectedCount: myPengembalian.filter(p => effectiveStatus(p) === 'Ditolak').length
    };

    res.render('pages/peminjam/pengembalian', {
      layout: 'layouts/peminjam',
      pageTitle: 'Pengembalian',
      currentPath: '/peminjam/pengembalian',
      eligibleLoans,
      returnCards,
      myPengembalian,
      formatTanggal: formatTanggalSaja,
      stats
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

// ---------- USER: Konfirmasi Pembayaran Denda ----------
exports.pay = async (req, res) => {
  try {
    const user = req.session.user;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID pengembalian wajib diisi.' });

    const paidId = await Pengembalian.pay(id, user.id);
    const item = await Pengembalian.findById(paidId);

    await LogAktivitas.record({
      req,
      aksi: 'Konfirmasi Pembayaran Denda',
      modul: 'Pengembalian',
      referensiTipe: 'pengembalian',
      referensiId: item.id,
      deskripsi: 'Peminjam ' + (user.nama_lengkap || user.username || '-') +
        ' mengonfirmasi pembayaran denda ' + item.kode_pengembalian +
        ' sebesar Rp ' + Number(item.denda || 0).toLocaleString('id-ID') + '.',
      metadata: {
        denda: Number(item.denda || 0),
        status_denda: item.status_denda,
        denda_dibayar: item.denda_dibayar
      }
    });

    success(res, item, 'Pembayaran denda dikonfirmasi. Menunggu verifikasi petugas.');
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
    const kondisi_fisik = body.kondisi_fisik;
    const catatan = body.catatan || body.catatan_pelanggaran;
    const denda = Math.max(0, Number(body.denda) || 0);
    const tanggal_kembali_aktual = body.tanggal_kembali_aktual;

    if (status !== 'Terverifikasi' && status !== 'Ditolak') {
      return res.status(400).json({
        ok: false,
        message: 'Status verifikasi harus Terverifikasi atau Ditolak.'
      });
    }
    if (status === 'Terverifikasi' && denda > 0) {
      return res.status(400).json({
        ok: false,
        message: 'Nominal denda sudah diisi. Gunakan tombol Tolak untuk mengirim pengajuan denda.'
      });
    }

    const verifiedId = await Pengembalian.verify(Number(req.params.id), petugas.id, {
      status, kondisi_fisik, catatan, denda, tanggal_kembali_aktual
    });

    const verified = await Pengembalian.findById(verifiedId);
    const isPenaltyRequest = status === 'Ditolak' && denda > 0;
    const aksi = isPenaltyRequest
      ? 'Pengajuan Denda Pengembalian'
      : 'Verifikasi Pengembalian - ' + status;
    const message = isPenaltyRequest
      ? 'Pengajuan denda dikirim ke peminjam. Menunggu pembayaran.'
      : 'Pengembalian ' + status + '.';

    await LogAktivitas.record({
      req,
      aksi,
      modul: 'Pengembalian',
      referensiTipe: 'pengembalian',
      referensiId: verified.id,
      deskripsi: isPenaltyRequest
        ? 'Petugas ' + petugas.nama_lengkap + ' mengajukan denda Rp ' +
          Number(verified.denda || 0).toLocaleString('id-ID') +
          ' untuk pengembalian ' + verified.kode_pengembalian + '.'
        : 'Verifikasi pengembalian ' + verified.kode_pengembalian +
          ' oleh petugas ' + petugas.nama_lengkap + ': ' + status,
      metadata: {
        status,
        kondisi_fisik: kondisi_fisik || null,
        catatan: catatan || null,
        denda: Number(verified.denda || 0),
        status_denda: verified.status_denda
      }
    });

    success(res, verified, message);
  } catch (error) {
    fail(res, error);
  }
};

// ---------- PETUGAS: Halaman Memantau Pengembalian ----------
exports.petugasPage = async (req, res) => {
  try {
    const items = await Pengembalian.getAll({});
    const stats = {
      pending: items.filter(p => effectiveStatus(p) === 'Menunggu Verifikasi' && !isPaid(p)).length,
      penalty: items.filter(p => effectiveStatus(p) === 'Bayar Denda').length,
      paid: items.filter(p => effectiveStatus(p) === 'Menunggu Verifikasi' && isPaid(p)).length,
      verified: items.filter(p => effectiveStatus(p) === 'Terverifikasi').length,
      rejected: items.filter(p => effectiveStatus(p) === 'Ditolak').length,
      total: items.length
    };

    res.render('pages/petugas/pengembalian', {
      layout: 'layouts/petugas',
      pageTitle: 'Verifikasi Pengembalian',
      currentPath: '/petugas/pengembalian',
      items,
      stats,
      formatTanggal: formatTanggalSaja
    });
  } catch (error) {
    console.error('Halaman pengembalian petugas error:', error);
    res.status(500).send('Gagal memuat halaman pengembalian.');
  }
};

// ---------- ADMIN: Halaman Kelola Pengembalian (read-only + hapus) ----------
exports.adminPage = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const filters = {
      statusVerifikasi: undefined,
      statusDenda: undefined,
      search: req.query.search || undefined
    };
    let paidOnly = false;

    if (status === 'Bayar Denda') {
      filters.statusDenda = 'Belum Lunas';
    } else if (status === 'Sudah Dibayarkan') {
      paidOnly = true;
    } else if (status) {
      filters.statusVerifikasi = status;
    }

    let items = await Pengembalian.getAll(filters);
    if (paidOnly) items = items.filter(isPaid);

    const stats = {
      total: (await Pengembalian.getAll({ search: filters.search })).length,
      pending: items.filter(p => effectiveStatus(p) === 'Menunggu Verifikasi' && !isPaid(p)).length,
      penalty: items.filter(p => effectiveStatus(p) === 'Bayar Denda').length,
      paid: items.filter(p => effectiveStatus(p) === 'Menunggu Verifikasi' && isPaid(p)).length,
      verified: items.filter(p => effectiveStatus(p) === 'Terverifikasi').length,
      rejected: items.filter(p => effectiveStatus(p) === 'Ditolak').length
    };

    res.render('pages/admin/pengembalian', {
      layout: 'layouts/admin',
      pageTitle: 'Kelola Pengembalian',
      currentPath: '/admin/pengembalian',
      items,
      stats,
      filters: { status, search: filters.search || '' },
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
      statusDenda: req.query.status_denda || undefined,
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

    const item = await Pengembalian.findById(id);
    if (!item) return res.status(404).json({ ok: false, message: 'Pengembalian tidak ditemukan.' });

    const removed = await Pengembalian.remove(id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Pengembalian tidak ditemukan.' });

    await LogAktivitas.record({
      req,
      aksi: 'Hapus Pengembalian',
      modul: 'Pengembalian',
      referensiTipe: 'pengembalian',
      referensiId: item.id,
      deskripsi: 'Menghapus data pengembalian ' + (item.kode_pengembalian || '-') +
        ' milik ' + (item.nama_lengkap || 'peminjam') + '.',
      metadata: { status_verifikasi: item.status_verifikasi, denda: Number(item.denda || 0) }
    });

    success(res, null, 'Pengembalian berhasil dihapus.');
  } catch (error) {
    fail(res, error);
  }
};