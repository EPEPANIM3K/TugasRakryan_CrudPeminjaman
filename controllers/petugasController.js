const Peminjaman = require('../models/Peminjaman');
const LogAktivitas = require('../models/LogAktivitas');
const { formatTanggalSaja, statusMeta } = require('../utils/format');

function fail(res, error) {
  console.error('Peminjaman petugas error:', error);
  const status = error && error.status ? error.status : 500;
  res.status(status).json({
    ok: false,
    message: (error && error.message) || 'Terjadi kesalahan pada server.'
  });
}

exports.peminjamanPage = async (req, res) => {
  try {
    const [items, stats, labs] = await Promise.all([
      Peminjaman.getAll({}),
      Peminjaman.getStats(),
      Peminjaman.getLabs()
    ]);

    res.render('pages/petugas/peminjaman', {
      layout: 'layouts/petugas',
      pageTitle: 'Menyetujui Peminjaman',
      currentPath: '/petugas/peminjaman',
      items,
      stats,
      labs,
      formatTanggal: formatTanggalSaja,
      statusMeta
    });
  } catch (error) {
    console.error('Halaman petugas peminjaman error:', error);
    res.status(500).send('Gagal memuat data peminjaman.');
  }
};

exports.approve = async (req, res) => {
  const catatan = String((req.body || {}).catatan || '').trim();
  try {
    await Peminjaman.approve(req.params.id, req.session.user.id, catatan);
    const item = await Peminjaman.findById(req.params.id);

    await LogAktivitas.record({
      req,
      aksi: 'Setujui Peminjaman',
      modul: 'Peminjaman',
      referensiTipe: 'peminjaman',
      referensiId: item.id,
      deskripsi: 'Menyetujui peminjaman ' + (item.kode_peminjaman || '-') +
        ' oleh ' + (item.nama_lengkap || 'peminjam') + '.',
      metadata: { catatan: catatan || null }
    });

    res.json({ ok: true, message: 'Permohonan peminjaman disetujui.', item });
  } catch (error) {
    fail(res, error);
  }
};

exports.reject = async (req, res) => {
  const catatan = String((req.body || {}).catatan || '').trim();
  if (!catatan) {
    return res.status(400).json({ ok: false, message: 'Alasan penolakan wajib diisi.' });
  }

  try {
    await Peminjaman.reject(req.params.id, req.session.user.id, catatan, catatan);
    const item = await Peminjaman.findById(req.params.id);

    await LogAktivitas.record({
      req,
      aksi: 'Tolak Peminjaman',
      modul: 'Peminjaman',
      referensiTipe: 'peminjaman',
      referensiId: item.id,
      deskripsi: 'Menolak peminjaman ' + (item.kode_peminjaman || '-') +
        ' oleh ' + (item.nama_lengkap || 'peminjam') + '. Alasan: ' + catatan,
      metadata: { alasan: catatan }
    });

    res.json({ ok: true, message: 'Permohonan peminjaman ditolak.', item });
  } catch (error) {
    fail(res, error);
  }
};