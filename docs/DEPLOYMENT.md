# Panduan Deployment InfoCVE

Panduan deployment InfoCVE ke berbagai lingkungan produksi: server mandiri (VPS / Linux Server / Docker) dan platform serverless (Vercel).

---

## 🏗️ 1. Deployment ke Server Mandiri (VPS / Ubuntu / Debian / Docker)

Deployment ke server mandiri adalah opsi paling direkomendasikan karena basis data SQLite (`node:sqlite`) dapat disimpan di media penyimpanan permanen (*persistent volume*).

### Langkah-langkah:

1. **Persiapan Server**:
   Pastikan Node.js $\ge$ 22.5.0 dan Git terpasang:
   ```bash
   node -v # Harus v22.5.0 atau lebih tinggi
   ```

2. **Kloning Kode Sumber**:
   ```bash
   git clone https://github.com/Fachri-analys/infocve.git
   cd infocve
   npm ci
   ```

3. **Konfigurasi Lingkungan Produksi**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` dengan nilai domain produksi Anda:
   ```env
   NEXT_PUBLIC_SITE_URL=https://infocve.id
   NVD_API_KEY=kunci_api_nist_anda
   ADMIN_SECRET=buat_token_acak_panjang_untuk_sync
   INFOCVE_DATA_DIR=/var/data/infocve
   ```

4. **Build dan Jalankan**:
   ```bash
   npm run build
   npm run start
   ```

5. **Menjalankan di Latar Belakang (Process Manager)**:
   Gunakan `pm2` untuk menjaga aplikasi selalu aktif:
   ```bash
   npm install -g pm2
   pm2 start npm --name "infocve" -- start
   pm2 save
   pm2 startup
   ```

---

## ⚡ 2. Deployment demo ke Vercel (Serverless)

Vercel dapat menjalankan UI dan route Next.js InfoCVE. Riwayat pemindai memakai PostgreSQL Neon bila `DATABASE_URL` (atau `POSTGRES_URL`) dipasang; data laporan tetap tersedia saat request masuk ke instance function lain. Tanpa URL database, aplikasi memakai SQLite lokal dan data hanya berlaku pada instance tersebut. Katalog CVE, cache terjemahan, dan status sinkronisasi masih memakai SQLite dan belum menjadi data bersama antarfungsi Vercel.

### Langkah-langkah:

1. **Hubungkan Repositori ke Vercel**:
   - Buka [vercel.com](https://vercel.com) dan pilih **Add New → Project**.
   - Pilih repositori `Fachri-analys/infocve`.
   - Framework preset akan terdeteksi otomatis sebagai **Next.js**.

2. **Siapkan database riwayat scanner**:
   - Buat project PostgreSQL di Neon, atau pasang integrasi Neon dari Vercel Marketplace.
   - Salin pooled connection string untuk project tersebut.
   - Untuk menguji koneksi dari lokal, buat Neon branch/database uji terpisah dari produksi, isi `TEST_DATABASE_URL` di `.env.local`, lalu jalankan `npm run test:neon`. Test menguji penyimpanan, pembacaan, token akses, hubungan scan ulang, dan retensi. Jangan arahkan test ke database produksi karena pemeriksaan retensi menghapus record yang sudah kedaluwarsa.
   - Di Vercel → **Settings → Environment Variables**, tambahkan `DATABASE_URL` (Production; tambahkan Preview jika dipakai untuk demo).
   - Jangan menaruh URL database pada kode, `NEXT_PUBLIC_*`, atau commit git. Tabel riwayat scan dibuat otomatis saat endpoint scanner pertama kali dipanggil.

3. **Pengaturan Environment Variables lainnya**:
   Di tab **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SITE_URL` = `https://nama-proyek-anda.vercel.app` (atau domain kustom Anda).
   - `INFOCVE_DATA_DIR` = `/tmp` (direktori sementara untuk SQLite; bukan penyimpanan persisten).
   - `NVD_API_KEY` (disarankan untuk mengurangi dampak rate limit NVD).
   - `ADMIN_SECRET` (wajib jika sinkronisasi dipicu melalui endpoint `/api/sync`).
   - Pilih runtime Node.js `22.x` atau lebih baru; InfoCVE membutuhkan Node.js `22.5+` untuk `node:sqlite`.

4. **Deploy dan isi data demo**:
   - Klik tombol **Deploy**.
   - Setelah deployment selesai, jalankan sinkronisasi ke URL production, bukan localhost. Dari PowerShell pada mesin lokal:
     ```powershell
     $env:NEXT_PUBLIC_SITE_URL = "https://nama-proyek-anda.vercel.app"
     npm run sync
     ```
     `ADMIN_SECRET` lokal harus sama dengan nilai di Vercel. `NVD_API_KEY` dibaca oleh function dari Environment Variables Vercel.
   - Buka URL production, jalankan pemindai dari halaman **Cari CVE**, lalu muat ulang hasil scan untuk memastikan laporan bisa dibaca kembali. Token akses hasil scan disimpan di browser yang membuatnya.
   - Sync CVE di `/api/sync` tetap menulis ke SQLite sementara. Karena itu, jangan menganggap katalog CVE yang disinkronkan dari satu function akan terlihat oleh function lain; untuk demo, pemindai dependency tetap mengecek OSV.dev dan GHSA secara langsung.
   - Video pemindaian yang sudah direkam tetap berguna sebagai cadangan jika layanan advisori eksternal sedang bermasalah.

Route `/api/sync` memakai Node.js runtime dan batas eksekusi 60 detik supaya sinkronisasi yang lebih lama dari default singkat tidak langsung timeout. Sinkronisasi otomatis melalui Vercel Cron tidak diperlukan untuk demo; Cron tidak membuat SQLite menjadi persisten.

---

## 🔄 3. Menjalankan Sinkronisasi Terjadwal (Cron Job)

Untuk memperbarui data CVE terbaru ke dalam basis data secara berkala, Anda dapat memasang cron job di server atau GitHub Actions:

```bash
# Contoh cron job setiap 6 jam
0 */6 * * * curl -X POST https://domain-anda.com/api/sync -H "Authorization: Bearer <ADMIN_SECRET>" -H "Content-Type: application/json"
```
