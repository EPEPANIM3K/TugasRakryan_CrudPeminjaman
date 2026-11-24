const db = require('../config/database');
const bcrypt = require('bcryptjs');

const ROLE_VALUES = ['admin', 'petugas', 'user'];
const STATUS_VALUES = ['Aktif', 'Pending', 'Suspend'];
const ACTIVE_LOAN_STATUSES = ['Disetujui', 'Dipinjam', 'Terlambat', 'Menunggu Verifikasi', 'Bayar Denda'];

function text(value) {
  return String(value == null ? '' : value).trim();
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

const User = {
  async findByEmailOrUsername(identifier) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE (email = ? OR username = ?) AND deleted_at IS NULL LIMIT 1',
      [identifier, identifier]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async updateLastLogin(id) {
    await db.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
  },

  async ensureDefaultUsers() {
    // shortcut: akun default di-reset ke password ini tiap server start, ganti jadi seed sekali jalan untuk produksi
    const defaults = [
      {
        nama_lengkap: 'Mas Admin',
        username: 'masadmin',
        email: 'masadmin@gmail.com',
        nip_nim: 'ADM-001',
        password: 'admin123',
        role: 'admin',
        tipe_pengguna: 'Administrator',
        fakultas_unit: 'Unit Laboratorium'
      },
      {
        nama_lengkap: 'User',
        username: 'user',
        email: 'user@gmail.com',
        nip_nim: 'USR-001',
        password: 'user123',
        role: 'user',
        tipe_pengguna: 'Mahasiswa',
        fakultas_unit: 'Fakultas Sains'
      },
      {
        nama_lengkap: 'Petugas',
        username: 'petugas',
        email: 'petugas@gmail.com',
        nip_nim: 'PTG-001',
        password: 'petugas123',
        role: 'petugas',
        tipe_pengguna: 'Petugas Lab',
        fakultas_unit: 'Unit Laboratorium'
      }
    ];

    for (const u of defaults) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ? OR username = ? OR nip_nim = ? LIMIT 1',
        [u.email, u.username, u.nip_nim]
      );

      if (existing.length > 0) {
        await db.execute(
          `UPDATE users
           SET nama_lengkap = ?, username = ?, email = ?, nip_nim = ?, password_hash = ?,
               role = ?, tipe_pengguna = ?, fakultas_unit = ?, status_akun = 'Aktif', deleted_at = NULL
           WHERE id = ?`,
          [u.nama_lengkap, u.username, u.email, u.nip_nim, passwordHash, u.role, u.tipe_pengguna, u.fakultas_unit, existing[0].id]
        );
      } else {
        await db.execute(
          `INSERT INTO users
           (nama_lengkap, username, email, nip_nim, password_hash, role, tipe_pengguna, fakultas_unit, status_akun)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aktif')`,
          [u.nama_lengkap, u.username, u.email, u.nip_nim, passwordHash, u.role, u.tipe_pengguna, u.fakultas_unit]
        );
      }
    }
  },

  async getAll(filters = {}) {
    const where = ['u.deleted_at IS NULL'];
    const params = [];

    if (filters.role && ROLE_VALUES.includes(filters.role)) {
      where.push('u.role = ?');
      params.push(filters.role);
    }
    if (filters.status && STATUS_VALUES.includes(filters.status)) {
      where.push('u.status_akun = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      const term = '%' + filters.search + '%';
      where.push('(u.nama_lengkap LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.nip_nim LIKE ? OR u.fakultas_unit LIKE ?)');
      params.push(term, term, term, term, term);
    }

    const [rows] = await db.execute(
      `SELECT u.id, u.nama_lengkap, u.username, u.email, u.nip_nim, u.role, u.tipe_pengguna,
              u.fakultas_unit, u.status_akun, u.last_login_at, u.created_at,
              COALESCE(pin.total, 0) AS active_pinjam
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS total
         FROM peminjaman
         WHERE status IN (${ACTIVE_LOAN_STATUSES.map(() => '?').join(', ')})
         GROUP BY user_id
       ) pin ON pin.user_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY u.id DESC`,
      [...ACTIVE_LOAN_STATUSES, ...params]
    );
    return rows;
  },

  async getStats() {
    const [[total]] = await db.execute('SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL');
    const [[aktif]] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND status_akun = 'Aktif'");
    const [[pending]] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND status_akun = 'Pending'");
    const [[pinjam]] = await db.execute(
      `SELECT COUNT(DISTINCT user_id) AS total FROM peminjaman WHERE status IN (${ACTIVE_LOAN_STATUSES.map(() => '?').join(', ')})`,
      ACTIVE_LOAN_STATUSES
    );
    return {
      total: Number(total.total) || 0,
      aktif: Number(aktif.total) || 0,
      pending: Number(pending.total) || 0,
      sedangMeminjam: Number(pinjam.total) || 0
    };
  },

  async create(data) {
    const nama = text(data.nama_lengkap);
    const username = text(data.username).replace(/^@+/, '');
    const email = text(data.email).toLowerCase();
    const nipNim = text(data.nip_nim);
    const role = text(data.role).toLowerCase();
    const tipe = text(data.tipe_pengguna);
    const fakultas = text(data.fakultas_unit);
    const status = text(data.status_akun) || 'Aktif';
    const password = String(data.password || '');

    if (!nama) throw badRequest('Nama lengkap wajib diisi.');
    if (!username) throw badRequest('Username wajib diisi.');
    if (!email) throw badRequest('Email wajib diisi.');
    if (!nipNim) throw badRequest('NIP/NIM wajib diisi.');
    if (!ROLE_VALUES.includes(role)) throw badRequest('Role tidak valid.');
    if (!STATUS_VALUES.includes(status)) throw badRequest('Status akun tidak valid.');
    if (password.length < 8) throw badRequest('Kata sandi minimal 8 karakter.');

    const [dup] = await db.execute(
      'SELECT id FROM users WHERE deleted_at IS NULL AND (username = ? OR email = ? OR nip_nim = ?) LIMIT 1',
      [username, email, nipNim]
    );
    if (dup.length) throw badRequest('Username, email, atau NIP/NIM sudah digunakan.');

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      `INSERT INTO users (nama_lengkap, username, email, nip_nim, password_hash, role, tipe_pengguna, fakultas_unit, status_akun)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nama, username, email, nipNim, passwordHash, role, tipe || null, fakultas || null, status]
    );
    return this.findById(result.insertId);
  },

  async update(id, data, actorId) {
    const targetId = Number(id);
    const existing = await this.findById(targetId);
    if (!existing) {
      const err = new Error('Pengguna tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    const nama = text(data.nama_lengkap);
    const username = text(data.username).replace(/^@+/, '');
    const email = text(data.email).toLowerCase();
    const nipNim = text(data.nip_nim);
    const role = text(data.role).toLowerCase();
    const tipe = text(data.tipe_pengguna);
    const fakultas = text(data.fakultas_unit);
    const status = text(data.status_akun) || 'Aktif';
    const password = String(data.password || '');

    if (!nama) throw badRequest('Nama lengkap wajib diisi.');
    if (!username) throw badRequest('Username wajib diisi.');
    if (!email) throw badRequest('Email wajib diisi.');
    if (!nipNim) throw badRequest('NIP/NIM wajib diisi.');
    if (!ROLE_VALUES.includes(role)) throw badRequest('Role tidak valid.');
    if (!STATUS_VALUES.includes(status)) throw badRequest('Status akun tidak valid.');
    if (password && password.length < 8) throw badRequest('Kata sandi minimal 8 karakter.');

    if (Number(actorId) === targetId && role !== 'admin') {
      throw badRequest('Anda tidak dapat mengubah role akun sendiri dari admin.');
    }
    if (Number(actorId) === targetId && status !== 'Aktif') {
      throw badRequest('Anda tidak dapat menonaktifkan akun sendiri.');
    }

    const [dup] = await db.execute(
      'SELECT id FROM users WHERE deleted_at IS NULL AND id <> ? AND (username = ? OR email = ? OR nip_nim = ?) LIMIT 1',
      [targetId, username, email, nipNim]
    );
    if (dup.length) throw badRequest('Username, email, atau NIP/NIM sudah digunakan.');

    const fields = ['nama_lengkap=?', 'username=?', 'email=?', 'nip_nim=?', 'role=?', 'tipe_pengguna=?', 'fakultas_unit=?', 'status_akun=?'];
    const params = [nama, username, email, nipNim, role, tipe || null, fakultas || null, status];
    if (password) {
      fields.push('password_hash=?');
      params.push(await bcrypt.hash(password, 10));
    }
    params.push(targetId);
    await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);
    return this.findById(targetId);
  },

  async remove(id, actorId) {
    const targetId = Number(id);
    if (!targetId) throw badRequest('ID pengguna tidak valid.');
    if (Number(actorId) === targetId) throw badRequest('Anda tidak dapat menghapus akun sendiri.');

    const existing = await this.findById(targetId);
    if (!existing) {
      const err = new Error('Pengguna tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    const [[activeLoan]] = await db.execute(
      `SELECT COUNT(*) AS total FROM peminjaman WHERE user_id = ? AND status IN (${ACTIVE_LOAN_STATUSES.map(() => '?').join(', ')})`,
      [targetId, ...ACTIVE_LOAN_STATUSES]
    );
    if (Number(activeLoan.total) > 0) {
      throw badRequest('Pengguna masih memiliki peminjaman aktif dan tidak dapat dihapus.');
    }

    if (existing.role === 'admin') {
      const [[admins]] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND status_akun='Aktif' AND deleted_at IS NULL");
      if (Number(admins.total) <= 1) throw badRequest('Tidak dapat menghapus admin aktif terakhir.');
    }

    const [result] = await db.execute(
      'UPDATE users SET deleted_at = NOW(), status_akun = "Suspend" WHERE id = ? AND deleted_at IS NULL',
      [targetId]
    );
    return result.affectedRows > 0;
  }
};

module.exports = User;