const db = require('../config/database');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const PENALTY_PER_DAY = 5000;

const SELECT = `
  SELECT pg.*,
    p.kode_peminjaman, p.user_id, p.tanggal_pinjam, p.tanggal_kembali_rencana,
    p.status AS peminjaman_status, p.catatan_peminjam, p.catatan_petugas AS peminjaman_catatan_petugas,
    u.nama_lengkap, u.username, u.email,
    (SELECT GROUP_CONCAT(a.nama_alat ORDER BY d.id SEPARATOR ', ')
       FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS alat_nama,
    (SELECT GROUP_CONCAT(a.kode_alat ORDER BY d.id SEPARATOR ', ')
       FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS alat_kode
  FROM pengembalian pg
  JOIN peminjaman p ON p.id = pg.peminjaman_id
  JOIN users u ON u.id = p.user_id`;

const Pengembalian = {
  async getAll(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.userId) {
      conditions.push('p.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.statusVerifikasi) {
      conditions.push('pg.status_verifikasi = ?');
      params.push(filters.statusVerifikasi);
    }
    if (filters.search) {
      const term = '%' + filters.search + '%';
      conditions.push(`(p.kode_peminjaman LIKE ? OR u.nama_lengkap LIKE ? OR u.email LIKE ?
        OR EXISTS (SELECT 1 FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
                   WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL
                     AND (a.nama_alat LIKE ? OR a.kode_alat LIKE ?)))`);
      params.push(term, term, term, term, term);
    }
    const sql = SELECT + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '') +
      ' ORDER BY pg.created_at DESC';
    const [rows] = await db.execute(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.execute(SELECT + ' WHERE pg.id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findByPeminjaman(peminjamanId) {
    const [rows] = await db.execute(SELECT + ' WHERE pg.peminjaman_id = ? LIMIT 1', [peminjamanId]);
    return rows[0] || null;
  },

  async create(userId, peminjamanId, data) {
    data = data || {};
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [loanRows] = await conn.execute(
        'SELECT * FROM peminjaman WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [peminjamanId]
      );
      const loan = loanRows[0];
      if (!loan) throw httpError(404, 'Peminjaman tidak ditemukan.');
      if (loan.user_id !== userId) throw httpError(403, 'Peminjaman bukan milik Anda.');
      const eligible = ['Disetujui', 'Dipinjam', 'Terlambat'];
      if (!eligible.includes(loan.status)) {
        throw httpError(400, 'Peminjaman berstatus "' + loan.status + '" tidak bisa diajukan pengembalian.');
      }

      const [existing] = await conn.execute(
        'SELECT id, status_verifikasi FROM pengembalian WHERE peminjaman_id = ? LIMIT 1 FOR UPDATE',
        [peminjamanId]
      );

      const actual = new Date();
      const rencana = new Date(loan.tanggal_kembali_rencana);
      let terlambatHari = 0;
      if (!isNaN(rencana.getTime()) && actual > rencana) {
        terlambatHari = Math.ceil((actual - rencana) / (1000 * 60 * 60 * 24));
      }
      const denda = terlambatHari * PENALTY_PER_DAY;
      const actualSql = actual.toISOString().slice(0, 19).replace('T', ' ');

      let pengembalianId;
      if (existing.length) {
        const ex = existing[0];
        if (ex.status_verifikasi !== 'Ditolak') {
          throw httpError(400, 'Pengembalian untuk peminjaman ini sudah diajukan.');
        }
        await conn.execute(
          `UPDATE pengembalian
           SET diajukan_oleh = ?, tanggal_diajukan = NOW(), tanggal_kembali_aktual = ?,
               kondisi_fisik = ?, catatan_pengembali = ?, terlambat_hari = ?, denda = ?,
               status_verifikasi = 'Menunggu Verifikasi', diverifikasi_oleh = NULL,
               diverifikasi_at = NULL, catatan_petugas = NULL
           WHERE id = ?`,
          [userId, actualSql, data.kondisi_fisik || null, data.catatan || null, terlambatHari, denda, ex.id]
        );
        pengembalianId = ex.id;
      } else {
        const kode = await this.nextKode(conn);
        const [result] = await conn.execute(
          `INSERT INTO pengembalian
           (kode_pengembalian, peminjaman_id, diajukan_oleh, tanggal_diajukan,
            tanggal_kembali_aktual, kondisi_fisik, catatan_pengembali,
            terlambat_hari, denda, status_verifikasi)
           VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'Menunggu Verifikasi')`,
          [kode, peminjamanId, userId, actualSql, data.kondisi_fisik || null, data.catatan || null, terlambatHari, denda]
        );
        pengembalianId = result.insertId;
      }

      await conn.execute(
        `UPDATE peminjaman SET status = 'Menunggu Verifikasi' WHERE id = ?`,
        [peminjamanId]
      );

      await conn.commit();
      return pengembalianId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async nextKode(conn) {
    const year = new Date().getFullYear();
    const prefix = 'KB-' + year + '-';
    const [rows] = await conn.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(kode_pengembalian, ?) AS UNSIGNED)), 0) AS max_seq
       FROM pengembalian
       WHERE kode_pengembalian LIKE ?`,
      [prefix.length + 1, prefix + '%']
    );
    const seq = Number(rows[0].max_seq) + 1;
    return prefix + String(seq).padStart(4, '0');
  },

  async verify(id, petugasId, data) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT * FROM pengembalian WHERE id = ? FOR UPDATE',
        [id]
      );
      const pg = rows[0];
      if (!pg) throw httpError(404, 'Pengembalian tidak ditemukan.');
      if (pg.status_verifikasi !== 'Menunggu Verifikasi') {
        throw httpError(400, 'Pengembalian sudah diverifikasi dengan status "' + pg.status_verifikasi + '".');
      }

      const status = data.status === 'Terverifikasi' ? 'Terverifikasi' : 'Ditolak';
      const kondisi = data.kondisi_fisik || pg.kondisi_fisik;
      const catatan = (data.catatan || '').trim() || null;

      // Recompute late days / denda if actual date provided
      let terlambatHari = pg.terlambat_hari;
      let denda = pg.denda;
      if (data.tanggal_kembali_aktual) {
        const actual = new Date(data.tanggal_kembali_aktual);
        const [loanRows] = await conn.execute(
          'SELECT tanggal_kembali_rencana FROM peminjaman WHERE id = ?',
          [pg.peminjaman_id]
        );
        const rencana = new Date(loanRows[0].tanggal_kembali_rencana);
        if (!isNaN(actual.getTime()) && !isNaN(rencana.getTime()) && actual > rencana) {
          terlambatHari = Math.ceil((actual - rencana) / (1000 * 60 * 60 * 24));
        } else {
          terlambatHari = 0;
        }
        denda = terlambatHari * PENALTY_PER_DAY;
      }

      await conn.execute(
        `UPDATE pengembalian
         SET status_verifikasi = ?, diverifikasi_oleh = ?, diverifikasi_at = NOW(),
             kondisi_fisik = ?, catatan_petugas = ?, terlambat_hari = ?, denda = ?,
             tanggal_kembali_aktual = COALESCE(?, tanggal_kembali_aktual)
         WHERE id = ?`,
        [
          status, petugasId, kondisi, catatan, terlambatHari, denda,
          data.tanggal_kembali_aktual || null, id
        ]
      );

      if (status === 'Terverifikasi') {
        // restore stock
        const [detailRows] = await conn.execute(
          'SELECT alat_id, jumlah FROM peminjaman_detail WHERE peminjaman_id = ? AND deleted_at IS NULL',
          [pg.peminjaman_id]
        );
        for (const d of detailRows) {
          await conn.execute(
            'UPDATE alat SET stok_tersedia = LEAST(stok_total, stok_tersedia + ?) WHERE id = ?',
            [d.jumlah, d.alat_id]
          );
          await conn.execute(
            `UPDATE alat SET status_alat = CASE WHEN stok_tersedia > 0 THEN 'Tersedia' ELSE 'Tidak Tersedia' END WHERE id = ?`,
            [d.alat_id]
          );
        }
        await conn.execute(
          `UPDATE peminjaman SET status = 'Selesai' WHERE id = ?`,
          [pg.peminjaman_id]
        );
      } else {
        // rejected: revert peminjaman to Dipinjam (still out) or Terlambat
        await conn.execute(
          `UPDATE peminjaman SET status = 'Dipinjam' WHERE id = ? AND status = 'Menunggu Verifikasi'`,
          [pg.peminjaman_id]
        );
      }

      await conn.commit();
      return id;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async remove(id) {
    const [result] = await db.execute('DELETE FROM pengembalian WHERE id = ?', [id]);
    // also revert peminjaman status if needed? Keep simple.
    return result.affectedRows > 0;
  }
};

module.exports = Pengembalian;
