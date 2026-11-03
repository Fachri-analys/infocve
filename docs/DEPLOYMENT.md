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

Vercel menjalankan UI, API, sinkronisasi, dan Cron. Neon (`DATABASE_URL` atau `POSTGRES_URL`) menyimpan katalog CVE bersama, status sinkronisasi, antrean terjemahan, rate limit, serta riwayat scanner. Pencarian/facet/statistik membaca katalog Neon; detail mencoba Neon lalu NVD live.

### Langkah-langkah:

1. **Hubungkan Repositori ke Vercel**:
   - Buka [vercel.com](https://vercel.com) dan pilih **Add New → Project**.
   - Pilih repositori `Fachri-analys/infocve`.
   - Framework preset akan terdeteksi otomatis sebagai **Next.js**.

2. **Siapkan database persisten**:
   - Buat project PostgreSQL di Neon, atau pasang integrasi Neon dari Vercel Marketplace.
   - Salin pooled connection string untuk project tersebut.
   - Untuk menguji koneksi dari lokal, buat Neon branch/database uji terpisah dari produksi, isi `TEST_DATABASE_URL` di `.env.local`, lalu jalankan `npm run test:neon`. Test menguji penyimpanan, pembacaan, token akses, hubungan scan ulang, dan retensi. Jangan arahkan test ke database produksi karena pemeriksaan retensi menghapus record yang sudah kedaluwarsa.
   - Di Vercel → **Settings → Environment Variables**, tambahkan `DATABASE_URL` (Production; tambahkan Preview jika dipakai). URL dipakai oleh katalog CVE dan scanner.
   - Jangan menaruh URL database pada kode, `NEXT_PUBLIC_*`, atau commit git. Tabel aplikasi dibuat otomatis saat pertama diakses.

3. **Pengaturan Environment Variables lainnya**:
   Di tab **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SITE_URL` = `https://nama-proyek-anda.vercel.app` (atau domain kustom Anda).
   - `NVD_API_KEY` (disarankan untuk mengurangi dampak rate limit NVD).
   - `ADMIN_SECRET` untuk sinkronisasi manual melalui `POST /api/sync`.
   - `CRON_SECRET` untuk mengotorisasi Vercel Cron yang memanggil `GET /api/sync` dan `GET /api/translations`.
   - Runtime Node.js `22.x` atau lebih baru.

4. **Deploy dan isi data demo**:
   - Klik tombol **Deploy**.
   - Setelah deployment selesai, jalankan sinkronisasi ke URL production, bukan localhost. Dari PowerShell pada mesin lokal:
     ```powershell
     $env:NEXT_PUBLIC_SITE_URL = "https://nama-proyek-anda.vercel.app"
     npm run sync
     ```
     `ADMIN_SECRET` lokal harus sama dengan nilai di Vercel. `NVD_API_KEY` dibaca oleh function dari Environment Variables Vercel.
   - Buka URL production, jalankan pemindai dari halaman **Cari CVE**, lalu muat ulang hasil scan untuk memastikan laporan bisa dibaca kembali. Token akses hasil scan disimpan di browser yang membuatnya.
   - Cron terjadwal berjalan harian. Sinkronisasi awal membackfill 120 hari terakhir; proses melanjutkan cursor jika belum selesai. Untuk mengisi segera, kirim `POST /api/sync` dengan `Authorization: Bearer <ADMIN_SECRET>`.
   - Video pemindaian yang sudah direkam tetap berguna sebagai cadangan jika layanan advisori eksternal sedang bermasalah.

### Memastikan data CVE tampil

1. Pastikan `DATABASE_URL` (atau `POSTGRES_URL`) dan `CRON_SECRET` terpasang di environment **Production**. `NVD_API_KEY` disarankan untuk menaikkan kuota request NVD; `ADMIN_SECRET` diperlukan jika menjalankan sync manual.
2. Buka `/api/health`; respons sehat mencantumkan `database: Neon Postgres`, statistik katalog, dan cursor sinkronisasi.
3. Jalankan sinkronisasi manual atau tunggu Cron. Cek `stats.available` dan `stats.total`; `sync.backfillCompletedAt` baru terisi setelah semua halaman 120 hari selesai, sedangkan status `incomplete` selama cursor masih berjalan adalah normal.
4. Jika katalog belum terisi, cek Runtime Logs untuk `/api/sync`, koneksi Neon, dan rate limit NVD. Data yang gagal diambil tidak boleh dianggap sebagai hasil kosong tervalidasi.

Route `/api/sync` dan `/api/translations` memakai Node.js runtime dan `maxDuration: 60`. Sinkronisasi NVD mengambil maksimal satu halaman 1.000 entri per invokasi, dengan timeout 45 detik dan satu percobaan NVD per invokasi. Cursor dilanjutkan pada pemanggilan berikutnya; Cron harian dapat memerlukan beberapa hari untuk menyelesaikan backfill yang besar. CVE inti di-upsert sebelum enrichment, sehingga enrichment yang lambat tidak mencegah data dasar disimpan. Tanggal `TIMESTAMPTZ` dari Neon harus diserialisasi sebagai ISO 8601 saat membentuk query NVD. EPSS dibatasi 5 request paralel, dan fallback metadata CNA mengerjakan maksimal 16 CVE dengan timeout 3 detik per lookup. Route terjemahan membatasi kerja aktif 42 detik, mengklaim sampai 512 deskripsi per putaran, membagi teks ke request LibreTranslate maksimum 32 deskripsi/60.000 karakter sumber, serta menjalankan maksimal 8 request serentak dengan timeout 4 detik dan satu retry. Jumlah batch disesuaikan berdasarkan estimasi timeout dan retry; deskripsi yang belum masuk budget dikembalikan ke antrean. Respons route menampilkan jumlah batch, request, hasil, waktu, dan antrean tersisa.

Jika sinkronisasi gagal, periksa Runtime Logs dan respons route. Error NVD menyertakan HTTP status dan alasan provider bila tersedia. Katalog kosong setelah sync gagal bukan bukti bahwa NVD tidak memiliki CVE.

Kedua Cron dijadwalkan harian pada jam berbeda (`0 5 * * *` dan `0 6 * * *`). Paket Vercel Hobby membatasi tiap cron agar berjalan sekali sehari; frekuensi lebih sering memerlukan paket Pro. Karena jadwal Hobby bisa bergeser hingga satu jam, jangan menganggap job berjalan tepat pada menit yang tertulis. Lihat [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) dan [mengelola Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

---

## 🔄 3. Menjalankan Sinkronisasi Terjadwal (Cron Job)

Untuk memperbarui data CVE terbaru ke dalam basis data secara berkala, Anda dapat memasang cron job di server atau GitHub Actions:

```bash
# Contoh cron job setiap 6 jam
0 */6 * * * curl -X POST https://domain-anda.com/api/sync -H "Authorization: Bearer <ADMIN_SECRET>" -H "Content-Type: application/json"
```
