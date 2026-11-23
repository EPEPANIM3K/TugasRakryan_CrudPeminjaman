const Peminjaman = require('../models/Peminjaman');
const Barang = require('../models/Barang');
const LogAktivitas = require('../models/LogAktivitas');
const { formatTanggalSaja, statusMeta } = require('../utils/format');

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function fail(res, error) {
  console.error('Peminjaman user error:', error);
  const status = error && error.status ? error.status : 500;
  res.status(status).json({
    ok: false,
    message: (error && error.message) || 'Terjadi kesalahan pada server.'
  });
}

exports.riwayatPage = async (req, res) => {
  try {
    const user = req.session.user;
    const [items, stats, availableAll] = await Promise.all([
      Peminjaman.getForUser(user.id),
      Peminjaman.getStats(user.id),
      Barang.getAvailable()
    ]);
    const available = availableAll.filter(function (alat) {
      return alat.status_alat === 'Tersedia' && Number(alat.stok_tersedia) > 0;
    });

    res.render('pages/peminjam/riwayat', {
      layout: 'layouts/peminjam',
      pageTitle: 'Peminjaman',
      currentPath: '/peminjam/riwayat',
      items,
      stats,
      available,
      formatTanggal: formatTanggalSaja,
      statusMeta
    });
  } catch (error) {
    console.error('Riwayat peminjaman error:', error);
    res.status(500).send('Gagal memuat data peminjaman.');
  }
};

exports.create = async (req, res) => {
  const body = req.body || {};
  const data = {
    alat_id: Number(body.alat_id),
    tanggal_pinjam: String(body.tanggal_pinjam || '').trim(),
    tanggal_kembali: String(body.tanggal_kembali || '').trim(),
    jumlah: Math.max(1, parseInt(body.jumlah, 10) || 1),
    tujuan: String(body.tujuan || '').trim(),
    catatan: String(body.catatan || '').trim()
  };

  if (!data.alat_id) {
    return res.status(400).json({ ok: false, message: 'Pilih alat yang ingin dipinjam.' });
  }
  if (!isDate(data.tanggal_pinjam) || !isDate(data.tanggal_kembali)) {
    return res.status(400).json({ ok: false, message: 'Tanggal peminjaman dan pengembalian wajib diisi.' });
  }
  if (data.tanggal_kembali < data.tanggal_pinjam) {
    return res.status(400).json({ ok: false, message: 'Tanggal pengembalian tidak boleh sebelum tanggal peminjaman.' });
  }
  if (!data.tujuan) {
    return res.status(400).json({ ok: false, message: 'Tujuan peminjaman wajib diisi.' });
  }

  try {
    const id = await Peminjaman.create(req.session.user.id, data);
    const item = await Peminjaman.findById(id);

    await LogAktivitas.record({
      req,
      aksi: 'Ajukan Peminjaman',
      modul: 'Peminjaman',
      referensiTipe: 'peminjaman',
      referensiId: id,
      deskripsi: 'Mengajukan peminjaman ' + (item.alat_nama || 'alat') +
        ' (' + (item.kode_peminjaman || '-') + ') selama ' +
        (data.tanggal_pinjam || '-') + ' s.d. ' + (data.tanggal_kembali || '-'),
      metadata: {
        alat_id: data.alat_id,
        jumlah: data.jumlah,
        tanggal_pinjam: data.tanggal_pinjam,
        tanggal_kembali: data.tanggal_kembali
      }
    });

    res.status(201).json({ ok: true, message: 'Permohonan peminjaman berhasil diajukan.', item });
  } catch (error) {
    fail(res, error);
  }
};

exports.cancel = async (req, res) => {
  try {
    const cancelled = await Peminjaman.cancel(req.params.id, req.session.user.id);
    if (!cancelled) {
      return res.status(400).json({
        ok: false,
        message: 'Peminjaman tidak ditemukan atau sudah diproses.'
      });
    }

    await LogAktivitas.record({
      req,
      aksi: 'Batalkan Peminjaman',
      modul: 'Peminjaman',
      referensiTipe: 'peminjaman',
      referensiId: req.params.id,
      deskripsi: 'Membatalkan permohonan peminjaman #' + req.params.id
    });

    res.json({ ok: true, message: 'Permohonan peminjaman dibatalkan.' });
  } catch (error) {
    fail(res, error);
  }
};