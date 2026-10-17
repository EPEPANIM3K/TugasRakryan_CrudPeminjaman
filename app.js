const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/admin');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(expressLayouts);
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    // Mengatur default pageTitle, bisa ditimpa di route
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

app.get('/admin/peminjaman', (req, res) => {
    res.render('pages/admin/peminjaman', {
        pageTitle: 'Kelola Peminjaman'
    });
});

app.get('/admin/pengembalian', (req, res) => {
    res.render('pages/admin/pengembalian', {
        pageTitle: 'Kelola Pengembalian'
    });
});

// =============================================
// ROUTE UNTUK HALAMAN AUTH / UMUM
// =============================================

app.get('/', (req, res) => {
    res.render('pages/auth/login', { layout: false });
});

// =============================================
// SERVER START
// =============================================
app.listen(3000, () => {
    console.log('SIPAT berjalan di http://localhost:3000');
});