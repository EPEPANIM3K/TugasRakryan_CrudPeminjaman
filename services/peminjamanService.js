const Peminjaman = require('../models/Peminjaman');

const PeminjamanService = {
  // Get all peminjaman with optional filters
  async getAll(filters = {}) {
    return await Peminjaman.getAll(filters);
  },

  // Get total count with optional filters
  async countTotal(filters = {}) {
    return await Peminjaman.countTotal(filters);
  },

  // Count by status
  async countByStatus() {
    return await Peminjaman.countByStatus();
  },

  // Get distinct statuses
  async getDistinctStatuses() {
    return await Peminjaman.getDistinctStatuses();
  },

  // Format status badge CSS classes
  formatStatusBadge(status) {
    const map = {
      'terlambat': 'bg-rose-500 text-rose-100',
      'dipinjam': 'bg-emerald-500 text-emerald-100',
      'dikembalikan': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'Menunggu Persetujuan': 'bg-amber-500 text-amber-100',
      'Disetujui': 'bg-emerald-500 text-emerald-100',
      'Ditolak': 'bg-rose-500 text-rose-100',
      'selesai': 'bg-emerald-500 text-emerald-100'
    };
    const cls = map[status] || 'bg-slate-500 text-slate-100';
    return { class: cls, text: status };
  }
};

module.exports = PeminjamanService;
