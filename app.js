require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const db = require('./config/database');
const User = require('./models/User');
const LogAktivitas = require('./models/LogAktivitas');
const { requireRole } = require('./middleware/role');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/admin');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
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

app.get('/admin/pengembalian', require('./controllers/pengembalianController').adminPage);



// =============================================
// ROUTE UNTUK HALAMAN AUTH / UMUM
// =============================================

app.get('/', (req, res) => {
    res.render('pages/auth/login', { layout: false });
});

app.get('/logout', async (req, res) => {
    if (req.session && req.session.user) {
        await LogAktivitas.record({
            req,
            aksi: 'Logout',
            modul: 'Auth',
            deskripsi: req.session.user.nama + ' keluar dari sistem'
        });
    }
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

app.get('/peminjam/pengembalian', require('./controllers/pengembalianController').userPage);

// API pengembalian
app.use('/pengembalian', require('./routes/pengembalian'));



// =============================================
// ROUTE UNTUK HALAMAN PETUGAS
// =============================================

app.get('/petugas', (req, res) => {
    res.redirect('/petugas/peminjaman');
});

app.use('/petugas', require('./routes/petugas'));

app.get('/petugas/pengembalian', require('./controllers/pengembalianController').petugasPage);

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
