# Panduan Deployment (Vercel)

Proyek ini adalah aplikasi Next.js standar tanpa basis data dan tanpa
kebutuhan infrastruktur khusus, sehingga deploy ke Vercel tidak memerlukan
konfigurasi tambahan di luar variabel environment.

## Lewat Dashboard Vercel

1. Push kode ini ke sebuah repositori Git (GitHub/GitLab/Bitbucket).
2. Di [vercel.com](https://vercel.com), pilih **Add New → Project**, lalu
   impor repositori tersebut.
3. Framework preset akan terdeteksi otomatis sebagai **Next.js** — tidak
   perlu mengubah build command (`next build`) atau output directory.
4. Tambahkan environment variable:
   - `NEXT_PUBLIC_SITE_URL` → domain produksi Anda, mis. `https://infocve.id`
     (dipakai oleh `sitemap.xml`, `robots.txt`, canonical URL, dan gambar
     Open Graph).
5. Klik **Deploy**.

## Lewat Vercel CLI

```bash
npm install -g vercel
vercel        # deploy preview
vercel --prod # deploy produksi
```

## Setup CI/CD di GitHub

Untuk memanfaatkan pipeline otomatis yang sudah disiapkan di `.github/workflows/`:

1. Masuk ke repository GitHub → **Settings → Secrets and variables → Actions**.
2. Tambahkan secret berikut bila Anda menggunakan deploy ke Vercel:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
3. Jika endpoint sinkronisasi dipakai, tambahkan:
   - `ADMIN_SECRET`
   - repository variable `DEPLOY_URL` (mis. `https://infocve.example.com`)
4. Pastikan branch `main` memiliki deploy production aktif dan branch `develop`
   dapat menerima preview deployment untuk PR.

## Setelah Deploy

- Verifikasi `/sitemap.xml` dan `/robots.txt` menunjuk ke domain yang benar.
- Verifikasi gambar Open Graph tampil benar lewat pratinjau tautan (mis.
  [opengraph.xyz](https://www.opengraph.xyz)) — dihasilkan otomatis oleh
  `app/opengraph-image.tsx`, tidak memerlukan berkas gambar statis.
- Custom domain dapat ditambahkan lewat tab **Domains** pada proyek Vercel.
- Setiap push ke branch non-utama otomatis mendapat Preview Deployment
  terpisah — berguna untuk meninjau perubahan sebelum digabungkan.

## Catatan

- Tidak ada database, sehingga tidak ada langkah migrasi atau seed data
  saat deploy.
- Jika/ketika integrasi NVD API sungguhan aktif (lihat
  `docs/API_INTEGRATION.md`), tambahkan `NVD_API_KEY` sebagai environment
  variable di Vercel dan pertimbangkan Vercel Data Cache / ISR untuk
  membatasi frekuensi pemanggilan API.
