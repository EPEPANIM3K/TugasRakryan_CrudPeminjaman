const db = require('../config/database');

const Peminjaman = {
  // Get all peminjaman with optional filters
  async getAll(filters = {}) {
    const pool = db();
    let query = 'SELECT * FROM peminjaman';
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push('(kode LIKE ? OR nama_pelapor LIKE ? OR alat LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (filters.lab) {
      conditions.push('lab = ?');
      params.push(filters.lab);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, params);
    return rows;
  },

  // Get total count
  async countTotal(filters = {}) {
    const pool = db();
    let query = 'SELECT COUNT(*) as total FROM peminjaman';
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push('(kode LIKE ? OR nama_pelapor LIKE ? OR alat LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  },

  // Count by status
  async countByStatus() {
    const pool = db();
    const [rows] = await pool.execute(
      'SELECT status, COUNT(*) as count FROM peminjaman GROUP BY status'
    );
    const result = {};
    rows.forEach(row => {
      result[row.status] = row.count;
    });
    return result;
  },

  // Get distinct statuses
  async getDistinctStatuses() {
    const pool = db();
    const [rows] = await pool.execute(
      'SELECT DISTINCT status FROM peminjaman ORDER BY status'
    );
    return rows.map(row => row.status);
  }
};

module.exports = Peminjaman;
