# InfoCVE

Basis pengetahuan kerentanan siber (CVE) untuk pengguna Indonesia — sederhana,
cepat, dan ramah pemula.

InfoCVE adalah situs edukasi yang menampilkan data kerentanan keamanan (CVE)
langsung dari **NVD REST API v2.0 resmi**, lengkap dengan penjelasan Bahasa
Indonesia, skor CVSS yang diuraikan per-metrik, dan glosarium istilah
keamanan siber. Proyek ini murni edukasi: tidak ada login, basis data, atau
integrasi AI.

## Fitur

- **Beranda** — pencarian besar, CVE terbaru, CVE kritis & tingkat tinggi, vendor/produk terbaru, kategori keamanan, ajakan belajar di glosarium.
- **Cari CVE** (`/search`) — pencarian berdasarkan ID/vendor/produk/kata kunci, dengan filter tingkat keparahan, tahun, vendor, produk, CWE, rentang tanggal publikasi/pembaruan, dan pengurutan.
- **Detail CVE** (`/cve/[id]`) — ID, tingkat keparahan, skor & rincian CVSS, CWE, produk terdampak, deskripsi asli + penjelasan Indonesia, riwayat, referensi.
- **Glosarium** (`/glossary`) — 20 istilah keamanan siber dengan pencarian instan di sisi klien.
- **Tentang, Privasi, Syarat & Ketentuan** — halaman informasi standar.

## Mulai Cepat

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplikasi berjalan penuh tanpa `NVD_API_KEY` (dengan limit permintaan lebih
ketat). Untuk menambahkannya:

```bash
# .env.local
NVD_API_KEY=kunci_api_anda   # daftar gratis: https://nvd.nist.gov/developers/request-an-api-key
```

Lihat `docs/INSTALLATION.md` untuk detail lebih lanjut, `docs/DEPLOYMENT.md`
untuk panduan deploy ke Vercel, dan `docs/API_INTEGRATION.md` untuk
bagaimana integrasi NVD API bekerja secara rinci.

## CI/CD & Deployment

Proyek sudah dilengkapi dengan workflow GitHub Actions untuk menjaga kualitas
kode dan mempermudah update di masa depan:

- `ci.yml` — menjalankan `npm ci`, lint, type-check, unit test, build, lalu
  deploy otomatis ke Vercel untuk preview/production bila secret relevan sudah
  diatur.
- `sync.yml` — memanggil endpoint `/api/sync` secara berkala dan mengecek
  health endpoint `GET /api/health`.
- `deps.yml` — memeriksa dependency yang sudah usang dan menjalankan audit
  keamanan ringan.

Secret yang biasanya perlu disetel di GitHub repository settings:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `ADMIN_SECRET`
- `DEPLOY_URL` (opsional, dipakai workflow sinkronisasi harian)

Quick: menambahkan API key & menguji (lokal / Vercel)

1) Buat file `.env.local` di root (jangan commit). Contoh minimal:

```env
# .env.local (contoh)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NVD_API_KEY=masukkan_kunci_nvd_anda
GITHUB_TOKEN=masukkan_github_token_anda
ADMIN_SECRET=token_admin_yg_aman
INFOCVE_DATA_DIR=./data
```

2) Jalankan server lokal:

```bash
npm install
npm run dev
```

3) Uji health endpoint (setelah aplikasi hidup):

```bash
curl -sS http://localhost:3000/api/health | jq
```

4) Memicu sinkronisasi manual (pakai ADMIN_SECRET):

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <ADMIN_SECRET>" \
  -H "Content-Type: application/json" | jq
```

5) Di Vercel (produksi), tambahkan variabel environment yang sama via
   Project Settings → Environment Variables (`NVD_API_KEY`, `GITHUB_TOKEN`,
   `ADMIN_SECRET`, `NEXT_PUBLIC_SITE_URL`). Workflow GitHub Actions akan
   menggunakan `VERCEL_*` secrets untuk deploy bila sudah diset di repository.

Dengan konfigurasi ini, proses develop → review → deploy bisa dijalankan
secara konsisten tanpa perlu mengubah logika aplikasi lagi saat release baru.

## Lisensi

MIT — lihat `LICENSE`.
