const db = require('../config/database');

const LOAN_SELECT = `
  SELECT p.*,
    u.nama_lengkap, u.username, u.email, u.role AS user_role,
    l.nama_lab,
    (SELECT GROUP_CONCAT(a.nama_alat ORDER BY d.id SEPARATOR ', ')
       FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS alat_nama,
    (SELECT GROUP_CONCAT(a.kode_alat ORDER BY d.id SEPARATOR ', ')
       FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS alat_kode,
    (SELECT GROUP_CONCAT(COALESCE(a.merk, '-') ORDER BY d.id SEPARATOR ', ')
       FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS alat_merk,
    (SELECT COALESCE(SUM(d.jumlah), 0)
       FROM peminjaman_detail d
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS total_jumlah
  FROM peminjaman p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN laboratorium l ON l.id = p.laboratorium_id
  WHERE p.deleted_at IS NULL`;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function detailsFor(executor, peminjamanId, lock) {
  const [rows] = await executor.execute(
    `SELECT d.*, a.kode_alat, a.nama_alat, a.merk, a.stok_total, a.stok_tersedia,
            a.laboratorium_id, a.status_alat
     FROM peminjaman_detail d
     JOIN alat a ON a.id = d.alat_id
     WHERE d.peminjaman_id = ? AND d.deleted_at IS NULL
     ${lock ? 'FOR UPDATE' : ''}`,
    [peminjamanId]
  );
  return rows;
}

async function nextKode(conn) {
  const year = new Date().getFullYear();
  const prefix = 'PJ-' + year + '-';
  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(kode_peminjaman, ?) AS UNSIGNED)), 0) AS max_seq
     FROM peminjaman
     WHERE kode_peminjaman LIKE ?`,
    [prefix.length + 1, prefix + '%']
  );
  return prefix + String(toNumber(rows[0].max_seq) + 1).padStart(4, '0');
}

async function adjustStock(conn, alatId) {
  await conn.execute(
    `UPDATE alat
     SET status_alat = CASE WHEN stok_tersedia > 0 THEN 'Tersedia' ELSE 'Tidak Tersedia' END,
         is_active = 1
     WHERE id = ?`,
    [alatId]
  );
}

const Peminjaman = {
  async getAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.userId) {
      conditions.push('p.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
    if (filters.lab) {
      conditions.push('l.nama_lab = ?');
      params.push(filters.lab);
    }
    if (filters.search) {
      const term = '%' + filters.search + '%';
      conditions.push(`(p.kode_peminjaman LIKE ? OR u.nama_lengkap LIKE ? OR u.email LIKE ?
        OR p.tujuan_peminjaman LIKE ?
        OR EXISTS (SELECT 1 FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
                   WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL AND a.nama_alat LIKE ?))`);
      params.push(term, term, term, term, term);
    }

    const sql = LOAN_SELECT +
      (conditions.length ? ' AND ' + conditions.join(' AND ') : '') +
      ' ORDER BY p.created_at DESC';

    const [rows] = await db.execute(sql, params);
    return rows;
  },

  async getForUser(userId) {
    return this.getAll({ userId });
  },

  async findById(id) {
    const [rows] = await db.execute(LOAN_SELECT + ' AND p.id = ? LIMIT 1', [id]);
    const loan = rows[0] || null;
    if (!loan) return null;
    loan.details = await detailsFor(db, loan.id, false);
    return loan;
  },

  async getStats(userId) {
    const params = [];
    let sql = 'SELECT status, COUNT(*) AS total FROM peminjaman WHERE deleted_at IS NULL';
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    sql += ' GROUP BY status';

    const [rows] = await db.execute(sql, params);
    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      borrowed: 0,
      done: 0,
      cancelled: 0
    };

    rows.forEach((row) => {
      const count = toNumber(row.total);
      stats.total += count;
      if (row.status === 'Menunggu Persetujuan') stats.pending += count;
      else if (row.status === 'Disetujui') stats.approved += count;
      else if (row.status === 'Ditolak') stats.rejected += count;
      else if (row.status === 'Dipinjam' || row.status === 'Terlambat') stats.borrowed += count;
      else if (row.status === 'Selesai') stats.done += count;
      else if (row.status === 'Dibatalkan') stats.cancelled += count;
    });

    return stats;
  },

  async getDistinctStatuses() {
    const [rows] = await db.execute(
      'SELECT DISTINCT status FROM peminjaman WHERE deleted_at IS NULL ORDER BY status ASC'
    );
    return rows.map((row) => row.status);
  },

  async getLabs() {
    const [rows] = await db.execute(`
      SELECT DISTINCT l.nama_lab
      FROM peminjaman p
      JOIN laboratorium l ON l.id = p.laboratorium_id
      WHERE p.deleted_at IS NULL AND l.nama_lab IS NOT NULL
      ORDER BY l.nama_lab ASC`);
    return rows.map((row) => row.nama_lab);
  },

  async create(userId, data) {
    const alatId = Number(data.alat_id);
    const jumlah = Math.max(1, parseInt(data.jumlah, 10) || 1);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [alatRows] = await conn.execute(
        `SELECT * FROM alat
         WHERE id = ? AND deleted_at IS NULL AND is_active = 1
         FOR UPDATE`,
        [alatId]
      );
      const alat = alatRows[0];
      if (!alat) throw httpError(404, 'Alat tidak ditemukan.');
      if (toNumber(alat.stok_tersedia) < jumlah) {
        throw httpError(400, 'Stok tersedia hanya ' + alat.stok_tersedia + ' unit.');
      }

      const kode = await nextKode(conn);
      const [result] = await conn.execute(
        `INSERT INTO peminjaman
         (kode_peminjaman, kode, user_id, laboratorium_id, tanggal_pinjam,
          tanggal_kembali_rencana, tujuan_peminjaman, catatan_peminjam, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu Persetujuan')`,
        [
          kode, kode, userId, alat.laboratorium_id,
          data.tanggal_pinjam, data.tanggal_kembali,
          data.tujuan, data.catatan || null
        ]
      );

      await conn.execute(
        'INSERT INTO peminjaman_detail (peminjaman_id, alat_id, jumlah) VALUES (?, ?, ?)',
        [result.insertId, alatId, jumlah]
      );

      await conn.commit();
      return result.insertId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async approve(id, petugasId, catatan) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [loanRows] = await conn.execute(
        'SELECT * FROM peminjaman WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      const loan = loanRows[0];
      if (!loan) throw httpError(404, 'Peminjaman tidak ditemukan.');
      if (loan.status !== 'Menunggu Persetujuan') {
        throw httpError(400, 'Peminjaman sudah diproses dengan status "' + loan.status + '".');
      }

      const details = await detailsFor(conn, id, true);
      if (!details.length) throw httpError(400, 'Detail peminjaman tidak ditemukan.');

      for (const detail of details) {
        if (toNumber(detail.stok_tersedia) < toNumber(detail.jumlah)) {
          throw httpError(400, 'Stok ' + detail.nama_alat + ' tidak mencukupi. Tersisa ' + detail.stok_tersedia + ' unit.');
        }
      }

      for (const detail of details) {
        await conn.execute(
          'UPDATE alat SET stok_tersedia = stok_tersedia - ? WHERE id = ?',
          [detail.jumlah, detail.alat_id]
        );
        await adjustStock(conn, detail.alat_id);
      }

      await conn.execute(
        `UPDATE peminjaman
         SET status = 'Disetujui', disetujui_oleh = ?, disetujui_at = NOW(), catatan_petugas = ?
         WHERE id = ?`,
        [petugasId, catatan || null, id]
      );

      await conn.commit();
      return id;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async reject(id, petugasId, alasan, catatan) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [loanRows] = await conn.execute(
        'SELECT * FROM peminjaman WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      const loan = loanRows[0];
      if (!loan) throw httpError(404, 'Peminjaman tidak ditemukan.');
      if (loan.status !== 'Menunggu Persetujuan') {
        throw httpError(400, 'Peminjaman sudah diproses dengan status "' + loan.status + '".');
      }

      await conn.execute(
        `UPDATE peminjaman
         SET status = 'Ditolak', ditolak_oleh = ?, ditolak_at = NOW(),
             alasan_penolakan = ?, catatan_petugas = ?
         WHERE id = ?`,
        [petugasId, alasan, catatan || alasan, id]
      );

      await conn.commit();
      return id;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async cancel(id, userId) {
    const [result] = await db.execute(
      `UPDATE peminjaman
       SET status = 'Dibatalkan'
       WHERE id = ? AND user_id = ? AND status = 'Menunggu Persetujuan' AND deleted_at IS NULL`,
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  async adminTransition(id, action) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [loanRows] = await conn.execute(
        'SELECT * FROM peminjaman WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      const loan = loanRows[0];
      if (!loan) throw httpError(404, 'Peminjaman tidak ditemukan.');

      let nextStatus = null;
      let restoreStock = false;

      if (action === 'dipinjam') {
        if (loan.status !== 'Disetujui') {
          throw httpError(400, 'Hanya peminjaman yang disetujui yang bisa ditandai dipinjam.');
        }
        nextStatus = 'Dipinjam';
      } else if (action === 'selesai') {
        if (loan.status !== 'Dipinjam' && loan.status !== 'Terlambat') {
          throw httpError(400, 'Hanya peminjaman aktif yang bisa ditandai selesai.');
        }
        nextStatus = 'Selesai';
        restoreStock = true;
      } else if (action === 'batal') {
        if (loan.status === 'Menunggu Persetujuan') {
          nextStatus = 'Dibatalkan';
        } else if (loan.status === 'Disetujui') {
          nextStatus = 'Dibatalkan';
          restoreStock = true;
        } else {
          throw httpError(400, 'Peminjaman berstatus "' + loan.status + '" tidak bisa dibatalkan.');
        }
      } else {
        throw httpError(400, 'Aksi peminjaman tidak dikenal.');
      }

      if (restoreStock) {
        const details = await detailsFor(conn, id, true);
        for (const detail of details) {
          await conn.execute(
            'UPDATE alat SET stok_tersedia = LEAST(stok_total, stok_tersedia + ?) WHERE id = ?',
            [detail.jumlah, detail.alat_id]
          );
          await adjustStock(conn, detail.alat_id);
        }
      }

      await conn.execute('UPDATE peminjaman SET status = ? WHERE id = ?', [nextStatus, id]);
      await conn.commit();
      return { id, status: nextStatus };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async remove(id) {
    const loan = await this.findById(id);
    if (!loan) throw httpError(404, 'Peminjaman tidak ditemukan.');

    const deletable = ['Menunggu Persetujuan', 'Ditolak', 'Dibatalkan', 'Selesai'];
    if (!deletable.includes(loan.status)) {
      throw httpError(400,
        'Peminjaman berstatus "' + loan.status + '" masih aktif. Selesaikan atau batalkan dulu sebelum menghapus.');
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE peminjaman SET deleted_at = NOW() WHERE id = ?', [id]);
      await conn.execute('UPDATE peminjaman_detail SET deleted_at = NOW() WHERE peminjaman_id = ?', [id]);
      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
};

module.exports = Peminjaman;