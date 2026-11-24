function formatTanggal(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { tanggal: '-', jam: '' };
  return {
    tanggal: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    jam: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  };
}

function formatTanggalSaja(value) {
  if (!value) return '-';
  const text = String(value).slice(0, 10);
  const date = new Date(text + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_META = {
  'Menunggu Persetujuan': {
    label: 'Menunggu',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    textClass: 'text-amber-600',
    dotClass: 'bg-amber-500'
  },
  'Disetujui': {
    label: 'Disetujui',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    textClass: 'text-emerald-600',
    dotClass: 'bg-emerald-500'
  },
  'Ditolak': {
    label: 'Ditolak',
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    textClass: 'text-rose-600',
    dotClass: 'bg-rose-500'
  },
  'Dipinjam': {
    label: 'Dipinjam',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    textClass: 'text-blue-600',
    dotClass: 'bg-blue-500'
  },
  'Terlambat': {
    label: 'Terlambat',
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    textClass: 'text-rose-600',
    dotClass: 'bg-rose-500'
  },
  'Menunggu Verifikasi': {
    label: 'Menunggu Verifikasi',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    textClass: 'text-amber-600',
    dotClass: 'bg-amber-500'
  },
  'Bayar Denda': {
    label: 'Bayar Denda',
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    textClass: 'text-rose-600',
    dotClass: 'bg-rose-500'
  },
  'Selesai': {
    label: 'Selesai',
    badgeClass: 'bg-slate-50 text-slate-700 border border-slate-200',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-400'
  },
  'Dibatalkan': {
    label: 'Dibatalkan',
    badgeClass: 'bg-slate-50 text-slate-600 border border-slate-200',
    textClass: 'text-slate-500',
    dotClass: 'bg-slate-400'
  }
};

function statusMeta(status) {
  return STATUS_META[status] || {
    label: status || '-',
    badgeClass: 'bg-slate-50 text-slate-700 border border-slate-200',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-400'
  };
}

module.exports = { formatTanggal, formatTanggalSaja, statusMeta };