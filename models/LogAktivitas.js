const db = require('../config/database');

function clientIp(req) {
  const forwarded = req && req.headers ? req.headers['x-forwarded-for'] : '';
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 45);
  return String((req && req.ip) || '').replace('::ffff:', '').slice(0, 45) || null;
}

const LogAktivitas = {
  async record(options = {}) {
    const req = options.req || null;
    const user = options.user || (req && req.session ? req.session.user : null);
    const role = options.role || (user && user.role) || 'system';
    const metadata = options.metadata == null ? null : JSON.stringify(options.metadata);

    try {
      await db.execute(
        `INSERT INTO log_aktivitas
         (user_id, role, aksi, modul, referensi_tipe, referensi_id, deskripsi, ip_address, user_agent, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user ? user.id : null,
          role,
          String(options.aksi || 'Aktivitas').slice(0, 100),
          options.modul || null,
          options.referensiTipe || null,
          options.referensiId || null,
          options.deskripsi || null,
          clientIp(req),
          req && req.headers ? String(req.headers['user-agent'] || '').slice(0, 255) || null : null,
          metadata
        ]
      );
    } catch (error) {
      // Logging tidak boleh menggagalkan aksi utama.
      console.error('Gagal mencatat log aktivitas:', error.message);
    }
  },

  async getAll(filters = {}) {
    const where = [];
    const params = [];

    if (filters.role) {
      where.push('l.role = ?');
      params.push(filters.role);
    }
    if (filters.modul) {
      where.push('l.modul = ?');
      params.push(filters.modul);
    }
    if (filters.search) {
      const term = '%' + filters.search + '%';
      where.push('(u.nama_lengkap LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR l.aksi LIKE ? OR l.deskripsi LIKE ?)');
      params.push(term, term, term, term, term);
    }

    const sql = `
      SELECT l.*, u.nama_lengkap, u.username, u.email
      FROM log_aktivitas l
      LEFT JOIN users u ON u.id = l.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY l.id DESC
      LIMIT 300`;

    const [rows] = await db.execute(sql, params);
    return rows;
  },

  async getStats() {
    const [[today]] = await db.execute(
      'SELECT COUNT(*) AS total FROM log_aktivitas WHERE DATE(created_at) = CURDATE()'
    );
    const [[month]] = await db.execute(
      'SELECT COUNT(*) AS total FROM log_aktivitas WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [[users]] = await db.execute(
      'SELECT COUNT(DISTINCT user_id) AS total FROM log_aktivitas WHERE user_id IS NOT NULL'
    );

    return {
      total: Number(month.total) || 0,
      today: Number(today.total) || 0,
      users: Number(users.total) || 0
    };
  },

  async getModules() {
    const [rows] = await db.execute(
      'SELECT DISTINCT modul FROM log_aktivitas WHERE modul IS NOT NULL ORDER BY modul ASC'
    );
    return rows.map((row) => row.modul);
  }
};

module.exports = LogAktivitas;