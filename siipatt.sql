-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 23, 2026 at 04:16 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sipat`
--

-- --------------------------------------------------------

--
-- Table structure for table `alat`
--

CREATE TABLE `alat` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `kode_alat` varchar(50) NOT NULL,
  `nama_alat` varchar(200) NOT NULL,
  `merk` varchar(120) DEFAULT NULL,
  `kategori_id` bigint(20) UNSIGNED DEFAULT NULL,
  `laboratorium_id` bigint(20) UNSIGNED DEFAULT NULL,
  `lokasi_rak` varchar(120) DEFAULT NULL,
  `deskripsi` text DEFAULT NULL,
  `foto_url` varchar(255) DEFAULT NULL,
  `stok_total` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `stok_tersedia` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `kondisi` enum('Baik','Rusak Ringan','Rusak Berat','Perawatan','Hilang') NOT NULL DEFAULT 'Baik',
  `status_alat` enum('Tersedia','Sedang Dipinjam','Tidak Tersedia','Perawatan') NOT NULL DEFAULT 'Tersedia',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ;

--
-- Dumping data for table `alat`
--

INSERT INTO `alat` (`id`, `kode_alat`, `nama_alat`, `merk`, `kategori_id`, `laboratorium_id`, `lokasi_rak`, `deskripsi`, `foto_url`, `stok_total`, `stok_tersedia`, `kondisi`, `status_alat`, `is_active`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'ALT-001', 'Digital Oscilloscope', 'Tektronix', 1, 1, 'Rak A1', 'Oscilloscope digital 2 channel', NULL, 4, 2, 'Baik', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(2, 'ALT-002', 'Multimeter Digital', 'Fluke', 1, 1, 'Rak A2', 'Multimeter digital presisi', NULL, 10, 8, 'Baik', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(3, 'ALT-003', 'Function Generator', 'Rigol', 1, 1, 'Rak B1', 'Signal generator', NULL, 3, 1, 'Rusak Ringan', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(4, 'ALT-004', 'Laptop Dell Latitude', 'Dell', 1, 1, 'Lemari 1', 'Laptop untuk praktikum', NULL, 15, 10, 'Baik', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(5, 'ALT-005', 'Router Mikrotik', 'Mikrotik', 1, 1, 'Rak Jaringan', 'Router latihan jaringan', NULL, 8, 5, 'Baik', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(6, 'ALT-006', 'Power Supply DC', 'GW Instek', 1, 1, 'Rak B2', 'Power supply adjustable', NULL, 5, 0, 'Baik', '', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(7, 'ALT-007', 'Proyektor Epson', 'Epson', 5, 1, 'Meja Depan', 'Proyektor presentasi', NULL, 2, 2, 'Baik', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL),
(8, 'ALT-008', 'Soldering Station', 'Hakko', 1, 1, 'Rak C1', 'Station solder digital', NULL, 6, 4, 'Baik', 'Tersedia', 1, '2026-11-23 08:57:50', '2026-11-23 08:57:50', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `kategori_alat`
--

CREATE TABLE `kategori_alat` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nama` varchar(100) NOT NULL,
  `deskripsi` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `kategori_alat`
--

INSERT INTO `kategori_alat` (`id`, `nama`, `deskripsi`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'Elektronik', NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(2, 'Biologi', NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(3, 'Kimia', NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(4, 'Instrumentasi', NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(5, 'Umum', NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `laboratorium`
--

CREATE TABLE `laboratorium` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `kode_lab` varchar(30) NOT NULL,
  `nama_lab` varchar(150) NOT NULL,
  `lokasi` varchar(200) DEFAULT NULL,
  `deskripsi` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `laboratorium`
--

INSERT INTO `laboratorium` (`id`, `kode_lab`, `nama_lab`, `lokasi`, `deskripsi`, `is_active`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'LAB-BIO', 'Lab Biologi', NULL, NULL, 1, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(2, 'LAB-KIM', 'Lab Kimia', NULL, NULL, 1, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(3, 'LAB-INS', 'Laboratorium Instrumentasi', NULL, NULL, 1, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(4, 'LAB-BIOK', 'Lab Biokimia', NULL, NULL, 1, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `log_aktivitas`
--

CREATE TABLE `log_aktivitas` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `role` enum('admin','petugas','user','system') DEFAULT 'system',
  `aksi` varchar(100) NOT NULL,
  `modul` varchar(50) DEFAULT NULL,
  `referensi_tipe` varchar(50) DEFAULT NULL,
  `referensi_id` bigint(20) UNSIGNED DEFAULT NULL,
  `deskripsi` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `peminjaman`
--

CREATE TABLE `peminjaman` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `kode_peminjaman` varchar(30) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `laboratorium_id` bigint(20) UNSIGNED DEFAULT NULL,
  `tanggal_pinjam` date NOT NULL,
  `tanggal_kembali_rencana` date NOT NULL,
  `tujuan_peminjaman` text NOT NULL,
  `catatan_peminjam` text DEFAULT NULL,
  `catatan_petugas` text DEFAULT NULL,
  `status` enum('Menunggu Persetujuan','Disetujui','Ditolak','Dipinjam','Terlambat','Menunggu Verifikasi','Bayar Denda','Selesai','Dibatalkan') NOT NULL DEFAULT 'Menunggu Persetujuan',
  `disetujui_oleh` bigint(20) UNSIGNED DEFAULT NULL,
  `disetujui_at` datetime DEFAULT NULL,
  `ditolak_oleh` bigint(20) UNSIGNED DEFAULT NULL,
  `ditolak_at` datetime DEFAULT NULL,
  `alasan_penolakan` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `kode` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `peminjaman_detail`
--

CREATE TABLE `peminjaman_detail` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `peminjaman_id` bigint(20) UNSIGNED NOT NULL,
  `alat_id` bigint(20) UNSIGNED NOT NULL,
  `jumlah` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `kondisi_pinjam` varchar(100) DEFAULT 'Baik',
  `catatan` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Table structure for table `pengembalian`
--

CREATE TABLE `pengembalian` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `kode_pengembalian` varchar(30) DEFAULT NULL,
  `peminjaman_id` bigint(20) UNSIGNED NOT NULL,
  `diajukan_oleh` bigint(20) UNSIGNED DEFAULT NULL,
  `tanggal_diajukan` datetime DEFAULT NULL,
  `tanggal_kembali_aktual` datetime DEFAULT NULL,
  `kondisi_fisik` enum('Baik & Lengkap','Rusak Ringan','Hilang / Tidak Lengkap','Rusak Berat') DEFAULT NULL,
  `checklist_inspeksi` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`checklist_inspeksi`)),
  `catatan_pengembali` text DEFAULT NULL,
  `catatan_petugas` text DEFAULT NULL,
  `terlambat_hari` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `denda` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status_denda` enum('Tidak Ada','Belum Lunas','Lunas') NOT NULL DEFAULT 'Tidak Ada',
  `tanggal_bayar_denda` datetime DEFAULT NULL,
  `denda_dibayar` tinyint(1) NOT NULL DEFAULT 0,
  `status_verifikasi` enum('Menunggu Verifikasi','Terverifikasi','Ditolak') NOT NULL DEFAULT 'Menunggu Verifikasi',
  `diverifikasi_oleh` bigint(20) UNSIGNED DEFAULT NULL,
  `diverifikasi_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nama_lengkap` varchar(150) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(150) NOT NULL,
  `nip_nim` varchar(50) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','petugas','user') NOT NULL DEFAULT 'user',
  `tipe_pengguna` varchar(50) DEFAULT NULL,
  `fakultas_unit` varchar(150) DEFAULT NULL,
  `status_akun` enum('Aktif','Suspend','Pending') NOT NULL DEFAULT 'Aktif',
  `avatar_url` varchar(255) DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `nama_lengkap`, `username`, `email`, `nip_nim`, `password_hash`, `role`, `tipe_pengguna`, `fakultas_unit`, `status_akun`, `avatar_url`, `last_login_at`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'Administrator SIPAT', 'admin', 'admin@sipat.local', 'ADM-001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'admin', 'Administrator', 'Unit Laboratorium', 'Aktif', NULL, NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(2, 'Petugas Laboratorium', 'petugas', 'petugas@sipat.local', 'PTG-001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'petugas', 'Petugas Lab', 'Unit Laboratorium', 'Aktif', NULL, NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL),
(3, 'Pengguna Demo', 'user', 'user@sipat.local', 'USR-001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'user', 'Mahasiswa', 'Fakultas Sains', 'Aktif', NULL, NULL, '2026-11-23 08:25:15', '2026-11-23 08:25:15', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `alat`
--
ALTER TABLE `alat`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_alat_kode` (`kode_alat`),
  ADD KEY `idx_alat_kategori` (`kategori_id`),
  ADD KEY `idx_alat_lab` (`laboratorium_id`),
  ADD KEY `idx_alat_status` (`status_alat`),
  ADD KEY `idx_alat_kondisi` (`kondisi`);

--
-- Indexes for table `kategori_alat`
--
ALTER TABLE `kategori_alat`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_kategori_nama` (`nama`);

--
-- Indexes for table `laboratorium`
--
ALTER TABLE `laboratorium`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_laboratorium_kode` (`kode_lab`),
  ADD KEY `idx_laboratorium_active` (`is_active`);

--
-- Indexes for table `log_aktivitas`
--
ALTER TABLE `log_aktivitas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_log_user` (`user_id`),
  ADD KEY `idx_log_aksi` (`aksi`),
  ADD KEY `idx_log_modul` (`modul`),
  ADD KEY `idx_log_created` (`created_at`);

--
-- Indexes for table `peminjaman`
--
ALTER TABLE `peminjaman`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_peminjaman_kode` (`kode_peminjaman`),
  ADD KEY `idx_peminjaman_user` (`user_id`),
  ADD KEY `idx_peminjaman_lab` (`laboratorium_id`),
  ADD KEY `idx_peminjaman_status` (`status`),
  ADD KEY `idx_peminjaman_tgl_pinjam` (`tanggal_pinjam`),
  ADD KEY `idx_peminjaman_tenggat` (`tanggal_kembali_rencana`),
  ADD KEY `fk_peminjaman_disetujui_oleh` (`disetujui_oleh`),
  ADD KEY `fk_peminjaman_ditolak_oleh` (`ditolak_oleh`);

--
-- Indexes for table `peminjaman_detail`
--
ALTER TABLE `peminjaman_detail`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_peminjaman_detail_peminjaman` (`peminjaman_id`),
  ADD KEY `idx_peminjaman_detail_alat` (`alat_id`);

--
-- Indexes for table `pengembalian`
--
ALTER TABLE `pengembalian`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pengembalian_peminjaman` (`peminjaman_id`),
  ADD UNIQUE KEY `uq_pengembalian_kode` (`kode_pengembalian`),
  ADD KEY `idx_pengembalian_status` (`status_verifikasi`),
  ADD KEY `idx_pengembalian_tgl_aktual` (`tanggal_kembali_aktual`),
  ADD KEY `fk_pengembalian_diajukan_oleh` (`diajukan_oleh`),
  ADD KEY `fk_pengembalian_diverifikasi_oleh` (`diverifikasi_oleh`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_username` (`username`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD UNIQUE KEY `uq_users_nip_nim` (`nip_nim`),
  ADD KEY `idx_users_role` (`role`),
  ADD KEY `idx_users_status` (`status_akun`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `alat`
--
ALTER TABLE `alat`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kategori_alat`
--
ALTER TABLE `kategori_alat`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `laboratorium`
--
ALTER TABLE `laboratorium`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `log_aktivitas`
--
ALTER TABLE `log_aktivitas`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `peminjaman`
--
ALTER TABLE `peminjaman`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `peminjaman_detail`
--
ALTER TABLE `peminjaman_detail`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pengembalian`
--
ALTER TABLE `pengembalian`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `alat`
--
ALTER TABLE `alat`
  ADD CONSTRAINT `fk_alat_kategori` FOREIGN KEY (`kategori_id`) REFERENCES `kategori_alat` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_alat_laboratorium` FOREIGN KEY (`laboratorium_id`) REFERENCES `laboratorium` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `log_aktivitas`
--
ALTER TABLE `log_aktivitas`
  ADD CONSTRAINT `fk_log_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `peminjaman`
--
ALTER TABLE `peminjaman`
  ADD CONSTRAINT `fk_peminjaman_disetujui_oleh` FOREIGN KEY (`disetujui_oleh`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_peminjaman_ditolak_oleh` FOREIGN KEY (`ditolak_oleh`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_peminjaman_lab` FOREIGN KEY (`laboratorium_id`) REFERENCES `laboratorium` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_peminjaman_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `peminjaman_detail`
--
ALTER TABLE `peminjaman_detail`
  ADD CONSTRAINT `fk_peminjaman_detail_alat` FOREIGN KEY (`alat_id`) REFERENCES `alat` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_peminjaman_detail_peminjaman` FOREIGN KEY (`peminjaman_id`) REFERENCES `peminjaman` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pengembalian`
--
ALTER TABLE `pengembalian`
  ADD CONSTRAINT `fk_pengembalian_diajukan_oleh` FOREIGN KEY (`diajukan_oleh`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pengembalian_diverifikasi_oleh` FOREIGN KEY (`diverifikasi_oleh`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pengembalian_peminjaman` FOREIGN KEY (`peminjaman_id`) REFERENCES `peminjaman` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
