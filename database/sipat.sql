-- =============================================
-- SIPAT - Sistem Informasi Peminjaman Alat Lab
-- Database Schema (MySQL / MariaDB)
-- =============================================
-- Jalankan di SQL editor / phpMyAdmin / MySQL client.
-- Disarankan: MySQL 8+ atau MariaDB 10.4+.

CREATE DATABASE IF NOT EXISTS sipat
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sipat;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- 1. USERS
--    Role sistem: admin, petugas, user
-- =============================================
DROP TABLE IF EXISTS log_aktivitas;
DROP TABLE IF EXISTS pengembalian;
DROP TABLE IF EXISTS peminjaman_detail;
DROP TABLE IF EXISTS peminjaman;
DROP TABLE IF EXISTS alat;
DROP TABLE IF EXISTS kategori_alat;
DROP TABLE IF EXISTS laboratorium;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama_lengkap    VARCHAR(150)    NOT NULL,
  username        VARCHAR(50)     NOT NULL,
  email           VARCHAR(150)    NOT NULL,
  nip_nim         VARCHAR(50)     DEFAULT NULL,          -- NIP/NIM/ID civitas
  password_hash   VARCHAR(255)    NOT NULL,              -- simpan hash (bcrypt/argon2), bukan plaintext
  role            ENUM('admin','petugas','user') NOT NULL DEFAULT 'user',
  tipe_pengguna   VARCHAR(50)     DEFAULT NULL,          -- contoh: Mahasiswa, Dosen, Dosen Peneliti, Staf
  fakultas_unit   VARCHAR(150)    DEFAULT NULL,
  status_akun     ENUM('Aktif','Suspend','Pending') NOT NULL DEFAULT 'Aktif',
  avatar_url      VARCHAR(255)    DEFAULT NULL,
  last_login_at   DATETIME        DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nip_nim (nip_nim),
  KEY idx_users_role (role),
  KEY idx_users_status (status_akun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. LABORATORIUM / RUANG
-- =============================================
CREATE TABLE laboratorium (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode_lab    VARCHAR(30)     NOT NULL,
  nama_lab    VARCHAR(150)    NOT NULL,
  lokasi      VARCHAR(200)    DEFAULT NULL,
  deskripsi   TEXT            DEFAULT NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_laboratorium_kode (kode_lab),
  KEY idx_laboratorium_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. KATEGORI ALAT
-- =============================================
CREATE TABLE kategori_alat (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama        VARCHAR(100)    NOT NULL,
  deskripsi   TEXT            DEFAULT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kategori_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. ALAT / BARANG INVENTARIS
-- =============================================
CREATE TABLE alat (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode_alat       VARCHAR(50)     NOT NULL,              -- kode inventaris, contoh: TL-001 / MCR-001
  nama_alat       VARCHAR(200)    NOT NULL,
  merk            VARCHAR(120)    DEFAULT NULL,
  kategori_id     BIGINT UNSIGNED DEFAULT NULL,
  laboratorium_id BIGINT UNSIGNED DEFAULT NULL,
  lokasi_rak      VARCHAR(120)    DEFAULT NULL,          -- rak/lemari
  deskripsi       TEXT            DEFAULT NULL,
  foto_url        VARCHAR(255)    DEFAULT NULL,          -- path/URL foto alat, contoh: /images/alat/tl-001.jpg
  stok_total      INT UNSIGNED    NOT NULL DEFAULT 0,
  stok_tersedia   INT UNSIGNED    NOT NULL DEFAULT 0,    -- dikurangi saat dipinjam/disetujui sesuai kebijakan
  kondisi         ENUM('Baik','Rusak Ringan','Rusak Berat','Perawatan','Hilang') NOT NULL DEFAULT 'Baik',
  status_alat     ENUM('Tersedia','Sedang Dipinjam','Tidak Tersedia','Perawatan') NOT NULL DEFAULT 'Tersedia',
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,    -- soft visibility
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alat_kode (kode_alat),
  KEY idx_alat_kategori (kategori_id),
  KEY idx_alat_lab (laboratorium_id),
  KEY idx_alat_status (status_alat),
  KEY idx_alat_kondisi (kondisi),
  CONSTRAINT fk_alat_kategori
    FOREIGN KEY (kategori_id) REFERENCES kategori_alat(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_alat_laboratorium
    FOREIGN KEY (laboratorium_id) REFERENCES laboratorium(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_alat_stok CHECK (stok_tersedia <= stok_total)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. PEMINJAMAN (HEADER)
-- =============================================
CREATE TABLE peminjaman (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode_peminjaman     VARCHAR(30)     NOT NULL,          -- contoh: PJ-2025-0901
  user_id             BIGINT UNSIGNED NOT NULL,          -- peminjam (role user)
  laboratorium_id     BIGINT UNSIGNED DEFAULT NULL,
  tanggal_pinjam      DATE            NOT NULL,
  tanggal_kembali_rencana DATE        NOT NULL,          -- tenggat/rencana kembali
  tujuan_peminjaman   TEXT            NOT NULL,
  catatan_peminjam    TEXT            DEFAULT NULL,
  catatan_petugas     TEXT            DEFAULT NULL,
  status              ENUM(
                        'Menunggu Persetujuan',
                        'Disetujui',
                        'Ditolak',
                        'Dipinjam',
                        'Terlambat',
                        'Menunggu Verifikasi',
                        'Selesai',
                        'Dibatalkan'
                      ) NOT NULL DEFAULT 'Menunggu Persetujuan',
  disetujui_oleh      BIGINT UNSIGNED DEFAULT NULL,     -- petugas/admin
  disetujui_at        DATETIME        DEFAULT NULL,
  ditolak_oleh        BIGINT UNSIGNED DEFAULT NULL,
  ditolak_at          DATETIME        DEFAULT NULL,
  alasan_penolakan    TEXT            DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_peminjaman_kode (kode_peminjaman),
  KEY idx_peminjaman_user (user_id),
  KEY idx_peminjaman_lab (laboratorium_id),
  KEY idx_peminjaman_status (status),
  KEY idx_peminjaman_tgl_pinjam (tanggal_pinjam),
  KEY idx_peminjaman_tenggat (tanggal_kembali_rencana),
  CONSTRAINT fk_peminjaman_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_peminjaman_lab
    FOREIGN KEY (laboratorium_id) REFERENCES laboratorium(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_peminjaman_disetujui_oleh
    FOREIGN KEY (disetujui_oleh) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_peminjaman_ditolak_oleh
    FOREIGN KEY (ditolak_oleh) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. PEMINJAMAN DETAIL
--    Mendukung >1 alat per peminjaman.
-- =============================================
CREATE TABLE peminjaman_detail (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  peminjaman_id   BIGINT UNSIGNED NOT NULL,
  alat_id         BIGINT UNSIGNED NOT NULL,
  jumlah          INT UNSIGNED    NOT NULL DEFAULT 1,
  kondisi_pinjam  VARCHAR(100)    DEFAULT 'Baik',        -- kondisi saat diserahkan
  catatan         TEXT            DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_peminjaman_detail_peminjaman (peminjaman_id),
  KEY idx_peminjaman_detail_alat (alat_id),
  CONSTRAINT fk_peminjaman_detail_peminjaman
    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_peminjaman_detail_alat
    FOREIGN KEY (alat_id) REFERENCES alat(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_peminjaman_detail_jumlah CHECK (jumlah > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. PENGEMBALIAN
--    Satu peminjaman bisa punya satu record pengembalian utama.
-- =============================================
CREATE TABLE pengembalian (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode_pengembalian   VARCHAR(30)     DEFAULT NULL,      -- contoh: KB-2025-0421
  peminjaman_id       BIGINT UNSIGNED NOT NULL,
  diajukan_oleh       BIGINT UNSIGNED DEFAULT NULL,     -- user yang mengajukan pengembalian
  tanggal_diajukan    DATETIME        DEFAULT NULL,
  tanggal_kembali_aktual DATETIME     DEFAULT NULL,     -- saat diserahkan/diverifikasi
  kondisi_fisik       ENUM('Baik & Lengkap','Rusak Ringan','Hilang / Tidak Lengkap','Rusak Berat') DEFAULT NULL,
  checklist_inspeksi  JSON            DEFAULT NULL,      -- checklist verifikasi petugas
  catatan_pengembali  TEXT            DEFAULT NULL,
  catatan_petugas     TEXT            DEFAULT NULL,
  terlambat_hari      INT UNSIGNED    NOT NULL DEFAULT 0,
  denda               DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  status_verifikasi   ENUM('Menunggu Verifikasi','Terverifikasi','Ditolak') NOT NULL DEFAULT 'Menunggu Verifikasi',
  diverifikasi_oleh   BIGINT UNSIGNED DEFAULT NULL,     -- petugas/admin
  diverifikasi_at     DATETIME        DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pengembalian_kode (kode_pengembalian),
  UNIQUE KEY uq_pengembalian_peminjaman (peminjaman_id),
  KEY idx_pengembalian_status (status_verifikasi),
  KEY idx_pengembalian_tgl_aktual (tanggal_kembali_aktual),
  CONSTRAINT fk_pengembalian_peminjaman
    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pengembalian_diajukan_oleh
    FOREIGN KEY (diajukan_oleh) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_pengembalian_diverifikasi_oleh
    FOREIGN KEY (diverifikasi_oleh) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 8. LOG AKTIVITAS
--    Untuk halaman admin/aktivitas.
-- =============================================
CREATE TABLE log_aktivitas (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED DEFAULT NULL,           -- aktor; NULL untuk sistem
  role          ENUM('admin','petugas','user','system') DEFAULT 'system',
  aksi          VARCHAR(100)    NOT NULL,               -- contoh: LOGIN, CREATE_ALAT, APPROVE_PEMINJAMAN
  modul         VARCHAR(50)     DEFAULT NULL,           -- contoh: auth, alat, peminjaman, pengembalian
  referensi_tipe VARCHAR(50)    DEFAULT NULL,           -- contoh: peminjaman, alat, user
  referensi_id  BIGINT UNSIGNED DEFAULT NULL,
  deskripsi     TEXT            DEFAULT NULL,
  ip_address    VARCHAR(45)     DEFAULT NULL,
  user_agent    VARCHAR(255)    DEFAULT NULL,
  metadata      JSON            DEFAULT NULL,           -- detail tambahan
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_log_user (user_id),
  KEY idx_log_aksi (aksi),
  KEY idx_log_modul (modul),
  KEY idx_log_created (created_at),
  CONSTRAINT fk_log_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- DATA AWAL (OPSIONAL)
-- =============================================

INSERT INTO laboratorium (kode_lab, nama_lab, lokasi) VALUES
('LAB-BIO', 'Lab Biologi', NULL),
('LAB-KIM', 'Lab Kimia', NULL),
('LAB-INS', 'Laboratorium Instrumentasi', NULL),
('LAB-BIOK', 'Lab Biokimia', NULL);

INSERT INTO kategori_alat (nama) VALUES
('Elektronik'),
('Biologi'),
('Kimia'),
('Instrumentasi'),
('Umum');

-- Contoh akun (GANTI password_hash dengan hash bcrypt/argon2 dari aplikasi Anda)
-- Password di bawah ini hanya placeholder, jangan dipakai production.
INSERT INTO users (nama_lengkap, username, email, nip_nim, password_hash, role, tipe_pengguna, fakultas_unit, status_akun) VALUES
('Administrator SIPAT', 'admin', 'admin@sipat.local', 'ADM-001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'admin', 'Administrator', 'Unit Laboratorium', 'Aktif'),
('Petugas Laboratorium', 'petugas', 'petugas@sipat.local', 'PTG-001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'petugas', 'Petugas Lab', 'Unit Laboratorium', 'Aktif'),
('Pengguna Demo', 'user', 'user@sipat.local', 'USR-001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'user', 'Mahasiswa', 'Fakultas Sains', 'Aktif');

-- =============================================
-- CATATAN DESAIN
-- =============================================
-- 1. Role sistem hanya 3: admin, petugas, user.
--    - admin   : kelola master data, user, monitoring, log.
--    - petugas : verifikasi/setujui peminjaman, verifikasi pengembalian, laporan.
--    - user    : peminjam (mahasiswa/dosen/peneliti) yang mengajukan pinjam/kembali.
-- 2. tipe_pengguna dipisah dari role agar identitas civitas (Mahasiswa/Dosen/dll) tetap tersimpan.
-- 3. peminjaman_detail disiapkan agar 1 peminjaman bisa memuat beberapa alat.
-- 4. status peminjaman mencakup alur UI: Menunggu Persetujuan, Disetujui, Ditolak, Dipinjam,
--    Terlambat, Menunggu Verifikasi, Selesai, Dibatalkan.
-- 5. stok_tersedia dapat di-update oleh aplikasi saat persetujuan/peminjaman/pengembalian.
-- 6. checklist_inspeksi dan metadata memakai JSON (MySQL 5.7+/MariaDB 10.2+).
-- 7. Untuk production: tambahkan migrasi, validasi aplikasi, hashing password, dan backup rutin.
