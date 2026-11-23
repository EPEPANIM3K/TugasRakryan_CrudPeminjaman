const db = require('../config/database');
const bcrypt = require('bcryptjs');

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
  }
};

module.exports = User;