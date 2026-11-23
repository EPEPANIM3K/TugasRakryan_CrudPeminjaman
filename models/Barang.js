const db = require('../config/database');

const SELECT_ALAT = `
  SELECT a.*, k.nama AS kategori_nama, l.nama_lab
  FROM alat a
  LEFT JOIN kategori_alat k ON k.id = a.kategori_id
  LEFT JOIN laboratorium l ON l.id = a.laboratorium_id
  WHERE a.deleted_at IS NULL`;

function text(value) {
  return String(value == null ? '' : value).trim();
}

async function resolveCategory(nama) {
  nama = text(nama);
  if (!nama) return null;
  const [rows] = await db.execute(
    'SELECT id FROM kategori_alat WHERE nama = ? AND deleted_at IS NULL LIMIT 1',
    [nama]
  );
  if (rows.length) return rows[0].id;
  const [result] = await db.execute('INSERT INTO kategori_alat (nama) VALUES (?)', [nama]);
  return result.insertId;
}

async function resolveLaboratorium(nama) {
  nama = text(nama);
  if (!nama) return null;
  const [rows] = await db.execute(
    'SELECT id FROM laboratorium WHERE nama_lab = ? AND deleted_at IS NULL LIMIT 1',
    [nama]
  );
  if (rows.length) return rows[0].id;
  const kode = 'LAB-' + Date.now().toString(36).toUpperCase();
  const [result] = await db.execute(
    'INSERT INTO laboratorium (kode_lab, nama_lab) VALUES (?, ?)',
    [kode, nama]
  );
  return result.insertId;
}

const Barang = {
  async getAll() {
    const [rows] = await db.execute(SELECT_ALAT + ' ORDER BY a.id DESC');
    return rows;
  },

  async getAvailable() {
    const [rows] = await db.execute(
      SELECT_ALAT + " AND a.is_active = 1 ORDER BY a.nama_alat ASC"
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await db.execute(SELECT_ALAT + ' AND a.id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async getStats() {
    const [rows] = await db.execute(`
      SELECT
        COALESCE(SUM(stok_total), 0) AS total,
        COALESCE(SUM(CASE WHEN kondisi = 'Baik' THEN stok_total ELSE 0 END), 0) AS baik,
        COALESCE(SUM(stok_total - stok_tersedia), 0) AS dipinjam,
        COUNT(DISTINCT laboratorium_id) AS lab
      FROM alat
      WHERE deleted_at IS NULL AND is_active = 1`);
    const row = rows[0] || {};
    return {
      total: Number(row.total) || 0,
      baik: Number(row.baik) || 0,
      dipinjam: Number(row.dipinjam) || 0,
      lab: Number(row.lab) || 0
    };
  },

  async nextKode() {
    const [rows] = await db.execute(
      "SELECT kode_alat FROM alat WHERE UPPER(kode_alat) REGEXP '^T[0-9]+$'"
    );
    let max = 0;
    rows.forEach((row) => {
      const number = parseInt(row.kode_alat.slice(1), 10);
      if (number > max) max = number;
    });
    return 'T' + String(max + 1).padStart(3, '0');
  },

  async create(data) {
    const kategori_id = await resolveCategory(data.kategori);
    const laboratorium_id = await resolveLaboratorium(data.ruang);
    const stok = Math.max(0, parseInt(data.stok, 10) || 0);
    const kode = await this.nextKode();

    const [result] = await db.execute(
      `INSERT INTO alat
       (kode_alat, nama_alat, merk, kategori_id, laboratorium_id, lokasi_rak,
        foto_url, stok_total, stok_tersedia, kondisi, status_alat, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Baik', ?, 1)`,
      [
        kode, text(data.nama), text(data.merek) || null,
        kategori_id, laboratorium_id, text(data.lokasi) || null,
        data.foto_url || null, stok, stok,
        stok > 0 ? 'Tersedia' : 'Tidak Tersedia'
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const old = await this.findById(id);
    if (!old) return null;

    const kategori_id = await resolveCategory(data.kategori);
    const laboratorium_id = await resolveLaboratorium(data.ruang);
    const stok = Math.max(0, parseInt(data.stok, 10) || 0);
    // Stok tersedia ikut bergeser sebesar perubahan stok total.
    const tersedia = Math.max(0, old.stok_tersedia + (stok - old.stok_total));
    const foto_url = data.foto_url !== undefined ? (data.foto_url || null) : old.foto_url;

    await db.execute(
      `UPDATE alat SET
         nama_alat = ?, merk = ?, kategori_id = ?, laboratorium_id = ?,
         lokasi_rak = ?, foto_url = ?, stok_total = ?, stok_tersedia = ?, status_alat = ?
       WHERE id = ?`,
      [
        text(data.nama), text(data.merek) || null,
        kategori_id, laboratorium_id, text(data.lokasi) || null,
        foto_url, stok, tersedia,
        tersedia > 0 ? 'Tersedia' : 'Tidak Tersedia', id
      ]
    );
    return this.findById(id);
  },

  async remove(id) {
    // shortcut: soft delete saja, file foto lama dibiarkan di disk
    const [result] = await db.execute(
      'UPDATE alat SET deleted_at = NOW(), is_active = 0 WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }
};

module.exports = Barang;