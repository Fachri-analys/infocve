# Panduan Instalasi InfoCVE

Panduan langkah-demi-langkah untuk menyiapkan dan menjalankan InfoCVE di lingkungan lokal Anda setelah melakukan clone dari repositori.

---

## 📋 Prasyarat Sistem

1. **Node.js $\ge$ 22.5.0**:
   - InfoCVE menggunakan modul database bawaan Node.js (`node:sqlite DatabaseSync`) yang membutuhkan Node.js versi 22.5.0 atau yang lebih baru.
   - Cek versi Anda dengan perintah:
     ```bash
     node -v
     ```
   - Jika versi Anda di bawah 22.5.0, perbarui Node.js melalui [nodejs.org](https://nodejs.org) atau manajer versi seperti `nvm` / `fnm`.

2. **npm $\ge$ 10.x**:
   - Manajer paket bawaan Node.js. File lockfile proyek adalah `package-lock.json`.

3. **Git**:
   - Untuk mengunduh kode sumber proyek.

---

## 🚀 Langkah-Langkah Pemasangan

### 1. Kloning Repositori
```bash
git clone https://github.com/Fachri-analys/infocve.git
cd infocve
```

### 2. Memasang Dependensi
```bash
npm install
```

> **Catatan Dependensi Font**: Proyek menggunakan font self-hosted IBM Plex melalui `@fontsource/*` yang terpasang di `node_modules`. Tidak ada koneksi ke Google Fonts eksternal yang diperlukan saat proses build.

### 3. Menyiapkan Konfigurasi Lingkungan
Salin file template `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

File `.env.local` Anda akan memuat konfigurasi awal:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# NVD_API_KEY=kunci_api_anda (opsional)
# GITHUB_TOKEN=token_anda (opsional)
# ADMIN_SECRET=token_rahasia_admin (direkomendasikan untuk sync)
# INFOCVE_DATA_DIR=./data (opsional)
```

> **Aplikasi Siap Digunakan Tanpa Kunci API**: Anda dapat langsung menjalankan InfoCVE tanpa mengisi `NVD_API_KEY`. InfoCVE akan otomatis beroperasi dalam mode gratis tanpa autentikasi (rate limit 5 req / 30 detik).

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000). Basis data SQLite lokal di `./data/infocve.sqlite` akan diinisialisasi otomatis saat pertama kali dibuka.

---

## 🛠️ Perintah Skrip yang Tersedia

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server lokal pengembangan (Next.js dengan Turbopack) |
| `npm run typecheck` | Menjalankan validasi tipe TypeScript (`tsc --noEmit`) |
| `npm run lint` | Menjalankan pengecekan linter ESLint |
| `npm test` | Menjalankan seluruh pengujian unit otomatis dengan Vitest |
| `npm run build` | Mengompilasi dan mengoptimasi aplikasi untuk produksi |
| `npm run start` | Menjalankan server hasil kompilasi produksi di lingkungan lokal |
| `npm run sync` | Menjalankan sinkronisasi data feed terbaru melalui CLI helper |

---

## ❓ Pemecahan Masalah Umum (Troubleshooting)

1. **Error: Cannot find module 'node:sqlite'**:
   - Pastikan versi Node.js Anda adalah **22.5.0 atau lebih tinggi**. Jalankan `node -v` untuk memastikan.
2. **Limit Permintaan NVD (HTTP 429)**:
   - Jika Anda sering mencari CVE secara intensif dan terkena rate limit, daftarkan kunci API gratis di [NIST NVD Developer Portal](https://nvd.nist.gov/developers/request-an-api-key) dan tambahkan ke `.env.local`:
     ```env
     NVD_API_KEY=kunci_dari_nist
     ```
3. **Database Lock Timeout**:
   - InfoCVE telah dikonfigurasi dengan mode WAL (*Write-Ahead Logging*) dan `PRAGMA busy_timeout = 5000;` sehingga aman dari benturan akses multi-proses.
