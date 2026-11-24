const fs = require('fs');

const size = 29;
const cellSize = 9;
const quiet = 4;
const qrPixels = (size + quiet * 2) * cellSize;
const width = 360;
const height = 460;
const qrX = (width - qrPixels) / 2;
const qrY = 86;

let seed = 20261124;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

const cells = [];
function isFinderCell(r, c) {
  const zones = [
    [0, 0], [0, size - 7], [size - 7, 0]
  ];
  for (const [zr, zc] of zones) {
    if (r >= zr && r < zr + 7 && c >= zc && c < zc + 7) return true;
  }
  return false;
}
function finderModule(r, c) {
  for (const [zr, zc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    if (r >= zr && r < zr + 7 && c >= zc && c < zc + 7) {
      const rr = r - zr;
      const cc = c - zc;
      const border = rr === 0 || rr === 6 || cc === 0 || cc === 6;
      const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
      return border || core;
    }
  }
  return false;
}

for (let r = 0; r < size; r++) {
  for (let c = 0; c < size; c++) {
    let dark;
    if (isFinderCell(r, c)) {
      dark = finderModule(r, c);
    } else {
      // Keep a small clear gutter around finder patterns.
      const nearFinder = (r < 8 && c < 8) || (r < 8 && c > size - 9) || (r > size - 9 && c < 8);
      if (nearFinder) {
        dark = false;
      } else {
        dark = rand() > 0.52;
      }
    }
    if (dark) cells.push([r, c]);
  }
}

const fontSize = 13;
const rects = cells.map(([r, c]) =>
  `<rect x="${qrX + (c + quiet) * cellSize}" y="${qrY + (r + quiet) * cellSize}" width="${cellSize}" height="${cellSize}" rx="1" />`
).join('');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">QRIS Pembayaran Denda</title>
  <desc id="desc">Gambar QRIS placeholder untuk pembayaran denda pengembalian alat.</desc>
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="24" fill="#f8fafc"/>
  <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="18" fill="#ffffff" stroke="#e2e8f0" filter="url(#shadow)"/>
  <g>
    <rect x="24" y="28" width="92" height="34" rx="8" fill="url(#brand)"/>
    <text x="70" y="50" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">QRIS</text>
    <text x="${width - 24}" y="50" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" text-anchor="end" letter-spacing="0.6">PLACEHOLDER</text>
  </g>
  <rect x="${qrX - 14}" y="${qrY - 14}" width="${qrPixels + 28}" height="${qrPixels + 28}" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <g fill="#0f172a">${rects}</g>
  <g font-family="Arial, Helvetica, sans-serif" text-anchor="middle">
    <text x="${width / 2}" y="404" font-size="15" font-weight="700" fill="#0f172a">Scan untuk Membayar</text>
    <text x="${width / 2}" y="426" font-size="11" font-weight="500" fill="#64748b">Gunakan aplikasi e-wallet / mobile banking</text>
    <text x="${width / 2}" y="444" font-size="10" font-weight="500" fill="#94a3b8">QRIS contoh — bukan transaksi sungguhan</text>
  </g>
</svg>
`;

fs.writeFileSync('public/images/qris-placeholder.svg', svg, 'utf8');
console.log('written', qrPixels, 'px QR area,', cells.length, 'modules');
