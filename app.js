require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const db = require('./config/database');
const User = require('./models/User');
const { requireRole } = require('./middleware/role');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/admin');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(expressLayouts);
app.use(session({
    // shortcut: MemoryStore hilang saat restart, pakai store persisten untuk produksi
    secret: process.env.SESSION_SECRET || 'sipat-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.pageTitle = 'Dashboard Admin';
    res.locals.currentUser = req.session.user || null;
    next();
});

// =============================================
// AUTENTIKASI
// =============================================

app.use('/auth', require('./routes/auth'));

app.use('/admin', requireRole('admin'));
app.use('/petugas', requireRole('petugas'));
app.use('/peminjam', requireRole('user'));

// =============================================
// ROUTE UNTUK HALAMAN ADMIN
// =============================================

app.get('/admin', (req, res) => {
    res.render('pages/admin/dashboard', {
        pageTitle: 'Dashboard Admin'
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

app.use('/peminjam', require('./routes/peminjam'));

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

async function initDatabase() {
    try {
        const connection = await db.getConnection();
        console.log('MySQL berhasil terhubung!');
        connection.release();
        await User.ensureDefaultUsers();
        console.log('Akun default siap.');
    } catch (error) {
        console.error('MySQL gagal terhubung:', error.message);
    }
}

initDatabase();

// =============================================
// SERVER START
// =============================================
const port = process.env.PORT || 3010;
app.listen(port, () => {
    console.log(`SIPAT berjalan di http://localhost:${port}`);
});
