const Peminjaman = require('../models/Peminjaman');
const LogAktivitas = require('../models/LogAktivitas');
const { formatTanggal, formatTanggalSaja, statusMeta } = require('../utils/format');

function fail(res, error) {
  console.error('Admin peminjaman error:', error);
  const status = error && error.status ? error.status : 500;
  res.status(status).json({
    ok: false,
    message: (error && error.message) || 'Terjadi kesalahan pada server.'
  });
}

const ROLE_LABEL = {
  admin: 'Admin',
  petugas: 'Petugas',
  user: 'User',
  system: 'Sistem'
};

exports.peminjamanPage = async (req, res) => {
  try {
    const filters = {
      status: String(req.query.status || '').trim(),
      search: String(req.query.search || '').trim(),
      lab: String(req.query.lab || '').trim()
    };
    const [items, stats, distinctStatuses, labs] = await Promise.all([
      Peminjaman.getAll(filters),
      Peminjaman.getStats(),
      Peminjaman.getDistinctStatuses(),
      Peminjaman.getLabs()
    ]);

    res.render('pages/admin/peminjaman', {
      pageTitle: 'Kelola Peminjaman',
      currentPath: '/admin/peminjaman',
      tableData: items,
      stats: {
        totalPengajuan: stats.total,
        menungguPersetujuan: stats.pending,
        disetujui: stats.approved,
        sedangDipinjam: stats.borrowed,
        selesai: stats.done
      },
      distinctStatuses,
      labs,
      filters,
      formatTanggal: formatTanggalSaja,
      statusMeta
    });
  } catch (error) {
    console.error('Halaman admin peminjaman error:', error);
    res.status(500).send('Gagal memuat data peminjaman.');
  }
};

exports.updateStatus = async (req, res) => {
  const action = String((req.body || {}).action || '').trim();
  const labels = {
    dipinjam: 'Tandai Dipinjam',
    selesai: 'Tandai Selesai',
    batal: 'Batalkan Peminjaman'
  };

  if (!labels[action]) {
    return res.status(400).json({ ok: false, message: 'Aksi tidak valid.' });
  }

  try {
    const before = await Peminjaman.findById(req.params.id);
    if (!before) return res.status(404).json({ ok: false, message: 'Peminjaman tidak ditemukan.' });

    const result = await Peminjaman.adminTransition(req.params.id, action);
    const item = await Peminjaman.findById(req.params.id);

    await LogAktivitas.record({
      req,
      aksi: labels[action],
      modul: 'Peminjaman',
      referensiTipe: 'peminjaman',
      referensiId: item.id,
      deskripsi: labels[action] + ' untuk ' + (item.kode_peminjaman || '-') +
        ' (' + (before.status || '-') + ' -> ' + result.status + ')',
      metadata: { dari: before.status, ke: result.status }
    });

    res.json({ ok: true, message: labels[action] + ' berhasil.', item });
  } catch (error) {
    fail(res, error);
  }
};

exports.removePeminjaman = async (req, res) => {
  try {
    const item = await Peminjaman.findById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'Peminjaman tidak ditemukan.' });

    await Peminjaman.remove(req.params.id);

    await LogAktivitas.record({
      req,
      aksi: 'Hapus Peminjaman',
      modul: 'Peminjaman',
      referensiTipe: 'peminjaman',
      referensiId: item.id,
      deskripsi: 'Menghapus data peminjaman ' + (item.kode_peminjaman || '-') +
        ' milik ' + (item.nama_lengkap || 'peminjam') + '.',
      metadata: { status: item.status }
    });

    res.json({ ok: true, message: 'Data peminjaman berhasil dihapus.' });
  } catch (error) {
    fail(res, error);
  }
};

exports.aktivitasPage = async (req, res) => {
  try {
    const filters = {
      search: String(req.query.search || '').trim(),
      role: String(req.query.role || '').trim(),
      modul: String(req.query.modul || '').trim()
    };
    const [logs, stats, modules] = await Promise.all([
      LogAktivitas.getAll(filters),
      LogAktivitas.getStats(),
      LogAktivitas.getModules()
    ]);

    res.render('pages/admin/aktivitas', {
      pageTitle: 'Log Aktivitas',
      currentPath: '/admin/aktivitas',
      logs,
      stats,
      modules,
      filters,
      roleLabel: (role) => ROLE_LABEL[role] || role || 'Sistem',
      formatTanggal
    });
  } catch (error) {
    console.error('Halaman log aktivitas error:', error);
    res.status(500).send('Gagal memuat log aktivitas.');
  }
};