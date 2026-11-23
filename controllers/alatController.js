const Barang = require('../models/Barang');

function formatTanggal(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { tanggal: '-', jam: '' };
  return {
    tanggal: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    jam: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  };
}

function isTersedia(item) {
  return item.status_alat === 'Tersedia' && Number(item.stok_tersedia) > 0;
}

function payload(req) {
  const body = req.body || {};
  const data = {
    nama: String(body.nama || '').trim(),
    kode: String(body.kode || '').trim(),
    merek: String(body.merek || '').trim(),
    kategori: String(body.kategori || '').trim(),
    ruang: String(body.ruang || '').trim(),
    lokasi: String(body.lokasi || '').trim(),
    stok: body.stok
  };
  if (req.file) data.foto_url = '/images/alat/' + req.file.filename;
  else if (body.remove_foto === '1') data.foto_url = null;
  return data;
}

function fail(res, error) {
  console.error('Alat error:', error);
  if (error && error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, message: 'Kode inventaris sudah dipakai alat lain.' });
  }
  res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
}

exports.adminPage = async (req, res) => {
  try {
    const [items, stats, nextKode] = await Promise.all([
      Barang.getAll(),
      Barang.getStats(),
      Barang.nextKode()
    ]);
    res.render('pages/admin/alat', {
      pageTitle: 'Kelola Alat & Barang',
      currentPath: '/admin/alat',
      items,
      stats,
      nextKode,
      formatTanggal
    });
  } catch (error) {
    fail(res, error);
  }
};

exports.userPage = async (req, res) => {
  try {
    const items = await Barang.getAvailable();
    const tersedia = items.filter(isTersedia).length;
    res.render('pages/peminjam/alat', {
      layout: 'layouts/peminjam',
      pageTitle: 'Katalog Alat Lab',
      currentPath: '/peminjam/alat',
      items,
      stats: { total: items.length, tersedia, dipinjam: items.length - tersedia },
      isTersedia
    });
  } catch (error) {
    fail(res, error);
  }
};

exports.create = async (req, res) => {
  const data = payload(req);
  if (!data.nama) {
    return res.status(400).json({ ok: false, message: 'Nama alat wajib diisi.' });
  }
  try {
    const item = await Barang.create(data);
    res.status(201).json({ ok: true, item });
  } catch (error) {
    fail(res, error);
  }
};

exports.update = async (req, res) => {
  const data = payload(req);
  if (!data.nama) {
    return res.status(400).json({ ok: false, message: 'Nama alat wajib diisi.' });
  }
  try {
    const item = await Barang.update(req.params.id, data);
    if (!item) return res.status(404).json({ ok: false, message: 'Data alat tidak ditemukan.' });
    res.json({ ok: true, item });
  } catch (error) {
    fail(res, error);
  }
};

exports.remove = async (req, res) => {
  try {
    const removed = await Barang.remove(req.params.id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Data alat tidak ditemukan.' });
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
};