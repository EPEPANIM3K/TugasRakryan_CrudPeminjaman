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

function isPenaltyPaid(row) {
  return Boolean(row) && (toNumber(row.denda_dibayar) === 1 || row.status_denda === 'Lunas');
}

const SELECT = `
  SELECT pg.*,
    p.kode_peminjaman, p.user_id, p.tanggal_pinjam, p.tanggal_kembali_rencana,
    p.status AS peminjaman_status, p.catatan_peminjam, p.catatan_petugas AS peminjaman_catatan_petugas,
    u.nama_lengkap, u.username, u.email,
    l.nama_lab,
    pv.nama_lengkap AS petugas_nama,
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
      WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL) AS jumlah_pinjam
  FROM pengembalian pg
  JOIN peminjaman p ON p.id = pg.peminjaman_id
  JOIN users u ON u.id = p.user_id
  LEFT JOIN laboratorium l ON l.id = p.laboratorium_id
  LEFT JOIN users pv ON pv.id = pg.diverifikasi_oleh
  WHERE pg.deleted_at IS NULL`;

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
    if (filters.statusDenda) {
      conditions.push('pg.status_denda = ?');
      params.push(filters.statusDenda);
    }
    if (filters.search) {
      const term = '%' + filters.search + '%';
      conditions.push(`(p.kode_peminjaman LIKE ? OR u.nama_lengkap LIKE ? OR u.email LIKE ?
        OR EXISTS (SELECT 1 FROM peminjaman_detail d JOIN alat a ON a.id = d.alat_id
                   WHERE d.peminjaman_id = p.id AND d.deleted_at IS NULL
                     AND (a.nama_alat LIKE ? OR a.kode_alat LIKE ?)))`);
      params.push(term, term, term, term, term);
    }
    const sql = SELECT + (conditions.length ? ' AND ' + conditions.join(' AND ') : '') +
      ' ORDER BY pg.created_at DESC';
    const [rows] = await db.execute(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.execute(SELECT + ' AND pg.id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findByPeminjaman(peminjamanId) {
    const [rows] = await db.execute(SELECT + ' AND pg.peminjaman_id = ? LIMIT 1', [peminjamanId]);
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
      if (Number(loan.user_id) !== Number(userId)) throw httpError(403, 'Peminjaman bukan milik Anda.');
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
               kondisi_fisik = ?, catatan_pengembali = ?, terlambat_hari = ?, denda = 0,
               status_denda = 'Tidak Ada', denda_dibayar = 0, tanggal_bayar_denda = NULL,
               status_verifikasi = 'Menunggu Verifikasi', diverifikasi_oleh = NULL,
               diverifikasi_at = NULL, catatan_petugas = NULL
           WHERE id = ?`,
          [userId, actualSql, data.kondisi_fisik || null, data.catatan || null, terlambatHari, ex.id]
        );
        pengembalianId = ex.id;
      } else {
        const kode = await this.nextKode(conn);
        const [result] = await conn.execute(
          `INSERT INTO pengembalian
           (kode_pengembalian, peminjaman_id, diajukan_oleh, tanggal_diajukan,
            tanggal_kembali_aktual, kondisi_fisik, catatan_pengembali,
            terlambat_hari, denda, status_denda, denda_dibayar, status_verifikasi)
           VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, 0, 'Tidak Ada', 0, 'Menunggu Verifikasi')`,
          [kode, peminjamanId, userId, actualSql, data.kondisi_fisik || null, data.catatan || null, terlambatHari]
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

  /**
   * Verifikasi oleh petugas.
   * - status Terverifikasi : selesaikan pengembalian (denda wajib sudah dibayar jika ada).
   * - status Ditolak + denda > 0 : kirim pengajuan denda ke peminjam (status efektif "Bayar Denda").
   * - status Ditolak tanpa denda : tolak pengembalian dan kembalikan peminjaman menjadi Dipinjam.
   */
  async verify(id, petugasId, data) {
    data = data || {};
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT pg.*, p.tanggal_kembali_rencana, p.status AS peminjaman_status, p.id AS loan_id ' +
        'FROM pengembalian pg JOIN peminjaman p ON p.id = pg.peminjaman_id ' +
        'WHERE pg.id = ? AND pg.deleted_at IS NULL FOR UPDATE',
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
      const dendaInput = Math.max(0, toNumber(data.denda));
      const paid = isPenaltyPaid(pg);

      let terlambatHari = toNumber(pg.terlambat_hari);
      if (data.tanggal_kembali_aktual) {
        const actual = new Date(data.tanggal_kembali_aktual);
        const rencana = new Date(pg.tanggal_kembali_rencana);
        if (!isNaN(actual.getTime()) && !isNaN(rencana.getTime()) && actual > rencana) {
          terlambatHari = Math.ceil((actual - rencana) / (1000 * 60 * 60 * 24));
        } else {
          terlambatHari = 0;
        }
      }

      if (status === 'Terverifikasi') {
        if (pg.status_denda === 'Belum Lunas' && !paid) {
          throw httpError(400, 'Denda belum dibayar oleh peminjam. Gunakan tombol Tolak untuk mengirim pengajuan denda.');
        }
        if (dendaInput > 0) {
          throw httpError(400, 'Nominal denda sudah diisi. Gunakan tombol Tolak untuk mengirim pengajuan denda.');
        }

        await conn.execute(
          `UPDATE pengembalian
           SET status_verifikasi = 'Terverifikasi', diverifikasi_oleh = ?, diverifikasi_at = NOW(),
               kondisi_fisik = ?, catatan_petugas = COALESCE(?, catatan_petugas),
               terlambat_hari = ?, status_denda = CASE WHEN denda > 0 THEN 'Lunas' ELSE 'Tidak Ada' END,
               tanggal_kembali_aktual = COALESCE(?, tanggal_kembali_aktual)
           WHERE id = ?`,
          [petugasId, kondisi, catatan, terlambatHari, data.tanggal_kembali_aktual || null, id]
        );

        // Kembalikan stok alat dan selesaikan peminjaman.
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
      } else if (dendaInput > 0) {
        // Pengajuan denda: pengembalian belum selesai, menunggu pembayaran peminjam.
        await conn.execute(
          `UPDATE pengembalian
           SET status_verifikasi = 'Menunggu Verifikasi', diverifikasi_oleh = ?, diverifikasi_at = NOW(),
               kondisi_fisik = ?, catatan_petugas = ?, terlambat_hari = ?, denda = ?,
               status_denda = 'Belum Lunas', denda_dibayar = 0, tanggal_bayar_denda = NULL,
               tanggal_kembali_aktual = COALESCE(?, tanggal_kembali_aktual)
           WHERE id = ?`,
          [petugasId, kondisi, catatan, terlambatHari, dendaInput, data.tanggal_kembali_aktual || null, id]
        );
        await conn.execute(
          `UPDATE peminjaman SET status = 'Bayar Denda' WHERE id = ?`,
          [pg.peminjaman_id]
        );
      } else {
        // Penolakan pengembalian tanpa denda: peminjaman kembali aktif.
        await conn.execute(
          `UPDATE pengembalian
           SET status_verifikasi = 'Ditolak', diverifikasi_oleh = ?, diverifikasi_at = NOW(),
               kondisi_fisik = ?, catatan_petugas = ?, terlambat_hari = ?, denda = 0,
               status_denda = 'Tidak Ada', denda_dibayar = 0, tanggal_bayar_denda = NULL,
               tanggal_kembali_aktual = COALESCE(?, tanggal_kembali_aktual)
           WHERE id = ?`,
          [petugasId, kondisi, catatan, terlambatHari, data.tanggal_kembali_aktual || null, id]
        );
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

  /**
   * Peminjam mengonfirmasi pembayaran denda (tanpa payment gateway).
   * Status pengembalian tetap "Menunggu Verifikasi" dan status denda menjadi "Lunas",
   * sehingga detail menampilkan "Sudah Dibayarkan" dan petugas dapat menyelesaikan verifikasi.
   */
  async pay(id, userId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        `SELECT pg.*, p.user_id, p.status AS peminjaman_status
         FROM pengembalian pg
         JOIN peminjaman p ON p.id = pg.peminjaman_id
         WHERE pg.id = ? AND pg.deleted_at IS NULL FOR UPDATE`,
        [id]
      );
      const pg = rows[0];
      if (!pg) throw httpError(404, 'Pengembalian tidak ditemukan.');
      if (Number(pg.user_id) !== Number(userId)) throw httpError(403, 'Pengembalian bukan milik Anda.');
      if (pg.status_verifikasi !== 'Menunggu Verifikasi') {
        throw httpError(400, 'Pengembalian sudah diproses dengan status "' + pg.status_verifikasi + '".');
      }
      if (pg.status_denda !== 'Belum Lunas' || toNumber(pg.denda) <= 0) {
        throw httpError(400, 'Pengembalian ini tidak memiliki denda yang harus dibayar.');
      }
      if (isPenaltyPaid(pg)) {
        throw httpError(400, 'Denda sudah dibayarkan.');
      }

      await conn.execute(
        `UPDATE pengembalian
         SET status_denda = 'Lunas', denda_dibayar = 1, tanggal_bayar_denda = NOW(),
             status_verifikasi = 'Menunggu Verifikasi'
         WHERE id = ?`,
        [id]
      );
      await conn.execute(
        `UPDATE peminjaman SET status = 'Menunggu Verifikasi' WHERE id = ?`,
        [pg.peminjaman_id]
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

  async remove(id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT * FROM pengembalian WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      const pg = rows[0];
      if (!pg) {
        await conn.rollback();
        return false;
      }

      // Jika pengembalian masih dalam proses, peminjaman kembali menjadi aktif.
      await conn.execute(
        `UPDATE peminjaman SET status = 'Dipinjam'
         WHERE id = ? AND status IN ('Menunggu Verifikasi', 'Bayar Denda')`,
        [pg.peminjaman_id]
      );
      await conn.execute('DELETE FROM pengembalian WHERE id = ?', [id]);

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

module.exports = Pengembalian;