require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const db = require('./config/database');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/admin');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(expressLayouts);
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.pageTitle = 'Dashboard Admin';
    next();
});

// =============================================
// ROUTE UNTUK HALAMAN ADMIN
// =============================================

app.get('/admin', (req, res) => {
    res.render('pages/admin/dashboard', {
        pageTitle: 'Dashboard Admin'
    });
});

app.get('/admin/alat', (req, res) => {
    res.render('pages/admin/alat', {
        pageTitle: 'Kelola Alat & Barang'
    });
});

app.get('/admin/users', (req, res) => {
    res.render('pages/admin/users', {
        pageTitle: 'Kelola Pengguna'
    });
});

// Route peminjaman menggunakan router admin
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

app.get('/admin/pengembalian', (req, res) => {
    res.render('pages/admin/pengembalian', {
        pageTitle: 'Kelola Pengembalian'
    });
});

app.get('/admin/aktivitas', (req, res) => {
    res.render('pages/admin/aktivitas', {
        pageTitle: 'Log Aktivitas'
    });
});

// =============================================
// ROUTE UNTUK HALAMAN AUTH / UMUM
// =============================================

app.get('/', (req, res) => {
    res.render('pages/auth/login', { layout: false });
});

app.get('/logout', (req, res) => {
    if (req.session && typeof req.session.destroy === 'function') {
        return req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    }
    res.redirect('/');
});

// =============================================
// ROUTE UNTUK HALAMAN PEMINJAM (USER)
// =============================================

app.get('/peminjam', (req, res) => {
    res.redirect('/peminjam/alat');
});

app.get('/peminjam/alat', (req, res) => {
    res.render('pages/peminjam/alat', {
        layout: 'layouts/peminjam',
        pageTitle: 'Katalog Alat Lab',
        currentPath: '/peminjam/alat'
    });
});

app.get('/peminjam/pengembalian', (req, res) => {
    res.render('pages/peminjam/pengembalian', {
        layout: 'layouts/peminjam',
        pageTitle: 'Pengembalian',
        currentPath: '/peminjam/pengembalian'
    });
});

app.get('/peminjam/riwayat', (req, res) => {
    const openModal = req.query.open === '1';
    const prefillKode = req.query.kode || '';
    const prefillNama = req.query.nama || '';
    res.render('pages/peminjam/riwayat', {
        layout: 'layouts/peminjam',
        pageTitle: 'Peminjaman',
        currentPath: '/peminjam/riwayat',
        openModal: openModal,
        prefillKode: prefillKode,
        prefillNama: prefillNama
    });
});

// =============================================
// ROUTE UNTUK HALAMAN PETUGAS
// =============================================

app.get('/petugas', (req, res) => {
    res.redirect('/petugas/peminjaman');
});

app.get('/petugas/peminjaman', (req, res) => {
    res.render('pages/petugas/peminjaman', {
        layout: 'layouts/petugas',
        pageTitle: 'Menyetujui Peminjaman',
        currentPath: '/petugas/peminjaman'
    });
});

app.get('/petugas/pengembalian', (req, res) => {
    res.render('pages/petugas/pengembalian', {
        layout: 'layouts/petugas',
        pageTitle: 'Memantau Pengembalian',
        currentPath: '/petugas/pengembalian'
    });
});

app.get('/petugas/laporan', (req, res) => {
    res.render('pages/petugas/laporan', {
        layout: 'layouts/petugas',
        pageTitle: 'Mencetak Laporan',
        currentPath: '/petugas/laporan'
    });
});

async function testDatabase() {
    try {
        const connection = await db.getConnection();
        console.log('MySQL berhasil terhubung!');
        connection.release();
    } catch (error) {
        console.error('MySQL gagal terhubung:', error.message);
    }
}

testDatabase();

// =============================================
// SERVER START
// =============================================
const port = process.env.PORT || 3010;
app.listen(port, () => {
    console.log(`SIPAT berjalan di http://localhost:${port}`);
});
