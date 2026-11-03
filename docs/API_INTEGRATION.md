# Integrasi NVD API

Status: **terhubung ke NVD REST API v2.0 sungguhan.** Tidak ada lagi data
tiruan (mock) di proyek ini — `lib/mock-data.ts` sudah dihapus. Dokumen ini
menjelaskan bagaimana lapisan data bekerja sekarang, keputusan desain di
baliknya, dan keterbatasan yang perlu diketahui.

## 1. Cara mengaktifkan

Tidak perlu perubahan kode apa pun. Cukup:

```bash
# .env.local
NVD_API_KEY=kunci_api_anda
```

Tanpa `NVD_API_KEY`, aplikasi tetap berjalan normal — permintaan hanya
dikirim tanpa header `apiKey`, sehingga tunduk pada limit yang lebih ketat
(5 permintaan/30 detik, bukan 50/30 detik). Ini bukan mode "rusak", hanya
lebih lambat di bawah trafik tinggi. Daftar kunci gratis di
<https://nvd.nist.gov/developers/request-an-api-key>.

## 2. Struktur berkas

Data layer dipecah menjadi empat berkas dengan tanggung jawab terpisah,
bukan satu berkas besar — ini murni soal keterbacaan/keterawatan (Clean
Architecture: setiap lapisan berubah karena alasan yang berbeda), **bukan**
perubahan pada apa yang diekspor `lib/nvd.ts` atau bagaimana halaman
memanggilnya:

| Berkas | Tanggung jawab |
|---|---|
| `lib/nvd-types.ts` | Bentuk mentah respons NVD API v2.0 (TypeScript types) |
| `lib/nvd-client.ts` | Transport HTTP: `AbortController` timeout, retry+backoff, penanganan status, `NvdApiError` |
| `lib/cwe-catalog.ts` | Tabel statis ID CWE → nama standar (NVD tidak pernah mengirim nama, hanya ID) |
| `lib/nvd-normalize.ts` | Memetakan respons mentah NVD → model internal `CVE` di `types/cve.ts` |
| `lib/nvd.ts` | **Satu-satunya** berkas yang diimpor halaman/komponen — orkestrasi + strategi query |

Tidak ada halaman atau komponen yang pernah menyentuh `fetch()` atau bentuk
respons NVD secara langsung; semuanya lewat `lib/nvd.ts`.

## 3. Tentang NVD API v2.0

- **Base URL:** `https://services.nvd.nist.gov/rest/json/cves/2.0` — satu-satunya
  endpoint yang dipakai proyek ini. Tidak ada scraping, tidak ada API tidak
  resmi.
- **Autentikasi:** header `apiKey` (bukan query param), dikirim hanya dari
  server (`lib/nvd-client.ts` memiliki `import "server-only"` sehingga
  build akan gagal jika modul ini pernah ter-import dari Client Component).
- **Rate limit:** 5 permintaan/30 detik tanpa kunci, 50/30 detik dengan
  kunci.
- **Batas rentang tanggal:** `pubStartDate`/`pubEndDate` dan
  `lastModStartDate`/`lastModEndDate` **wajib dikirim sepasang** (tidak
  boleh hanya salah satu) dan **maksimum 120 hari** per permintaan — bukan
  batasan yang saya asumsikan, ini didokumentasikan resmi dan diverifikasi
  ulang saat implementasi ini ditulis. Kedua jenis rentang tanggal **tidak
  bisa dipakai bersamaan** dalam satu permintaan.
- **Parameter bernilai tunggal:** `cvssV3Severity` dan `cweId` masing-masing
  hanya menerima **satu** nilai per permintaan, bukan daftar.
- **Tidak ada endpoint agregasi/facet.** NVD tidak menyediakan cara untuk
  bertanya "vendor apa saja yang ada" atau "berapa total CVE per tahun" —
  hanya daftar record CVE per permintaan.
- **Ketentuan data:** ikuti [NVD Terms of Use](https://nvd.nist.gov/developers/terms-of-use) dan [CVE Program Terms of Use](https://www.cve.org/Legal/TermsOfUse); data publik tidak otomatis berarti semua field bebas didistribusikan ulang tanpa syarat.
- **Dokumentasi resmi:** <https://nvd.nist.gov/developers/vulnerabilities>

## 4. Strategi query — kenapa perlu "perencanaan"

UI pencarian mendukung filter gabungan yang tidak tersedia sebagai satu query
NVD. Filter pencarian dijalankan di katalog InfoCVE setelah proses sync.

Pada Vercel, `searchCVEs()` membaca seluruh katalog `infocve_cves` dari Neon.
Query teks dan filter menggunakan parameter SQL, total halaman dihitung dari
`COUNT(*)`, lalu sorting dan offset diterapkan pada katalog yang sama. SQLite
lokal menjalankan filter melalui repository lokal. Daftar tidak menampilkan
CVE berstatus `Rejected`.

NVD menjadi sumber sinkronisasi, bukan query langsung untuk setiap halaman.
Rentang NVD dibatasi maksimal 120 hari dan setiap halaman berisi maksimal
2.000 record. Cursor di `infocve_sync_state` memungkinkan backfill dan sync
inkremental berlanjut pada eksekusi berikut. Detail CVE mencoba Neon lebih dulu
dan memakai NVD live jika record tidak ditemukan.

## 5. Facet (vendor/produk/kategori/tahun/CWE) & statistik beranda

Facet vendor, produk, kategori, tahun, dan CWE memakai query agregat dari
katalog yang sama dengan pencarian. Filter aktif dipertahankan, kecuali filter
facet yang sedang dihitung dihilangkan; vendor dan produk null diabaikan.
Beranda dan dashboard memakai agregat katalog Neon penuh, bukan sampel.
NVD tidak menyediakan endpoint agregasi global, jadi metrik dihitung dari
record yang telah tersinkron.

Jika katalog kosong, periksa `sync.backfillCompletedAt` dan
`sync.lastModifiedAt` di `/api/health`, lalu tinjau log route sync. Neon
memerlukan `DATABASE_URL` atau `POSTGRES_URL`; `NVD_API_KEY` meningkatkan
kuota NVD sedangkan Neon memberi penyimpanan bersama.

## 6. Normalisasi — hal-hal yang tidak disediakan NVD secara langsung

`lib/nvd-normalize.ts` menangani beberapa realita data sungguhan yang tidak
pernah muncul di data mock:

- **Skor CVSS** — sebuah CVE bisa punya v3.1, v3.0, v2, atau tidak sama
  sekali (mis. status "Awaiting Analysis"). Urutan preferensi: v3.1 → v3.0
  → v2 → nilai default "belum dinilai". Untuk v2 (jarang, biasanya CVE
  lama), beberapa sub-metrik seperti `privilegesRequired`/`scope` tidak ada
  konsepnya di v2 — dipetakan sebaik mungkin dari vector string, dicatat
  sebagai pendekatan (bukan terjemahan presisi) di komentar kode.
- **Nama vendor/produk** — NVD hanya memberi string CPE 2.3
  (`cpe:2.3:a:apache:log4j:...`), bukan field vendor/produk biasa. Diambil
  dari segmen CPE lalu dirapikan (mis. `log4j` → `Log4j`) — heuristik
  sederhana, bukan kamus CPE resmi, jadi sesekali bisa kurang sempurna
  untuk nama vendor yang tidak umum.
- **Nama CWE** — NVD hanya memberi ID (`CWE-79`), tidak pernah nama. Nama
  dicari di katalog penuh CWE dari MITRE. Jika ID belum dikenal, UI
  menampilkan ID tersebut tanpa label generik.
- **Kategori** (`web-application`, `network`, dst.) — konsep buatan
  aplikasi ini sepenuhnya; NVD tidak memiliki taksonomi ini. Diperkirakan
  dari kombinasi `part` CPE (`o`=sistem operasi, `h`=perangkat keras,
  `a`=aplikasi), beberapa CWE yang identik dengan celah web (XSS, SQLi,
  CSRF, dst.), dan kata kunci cloud pada deskripsi — heuristik yang
  disengaja sederhana, didokumentasikan di kode, bukan pengklasifikasi
  yang mengklaim akurasi tinggi.
- **Judul** — NVD tidak memberi judul sama sekali, hanya deskripsi. Judul
  diturunkan dari ~100 karakter pertama deskripsi (setelah membuang akhiran
  "This CVE ID is unique from..." yang kadang ditambahkan NVD), bukan
  informasi yang benar-benar disediakan NVD.
- **Penjelasan Indonesia (`descriptionId`)** — teks Inggris selalu disimpan
  bersama status terjemahan. Jika provider LibreTranslate-compatible
  dikonfigurasi, antrean persisten menerjemahkan berdasarkan hash sumber,
  mencoba ulang kegagalan, dan mempertahankan identifier teknis. Bila provider
  gagal atau tidak diatur, halaman menampilkan deskripsi Inggris; UI menyediakan
  status terjemahan dan opsi deskripsi asli.

## 7. Penanganan error

- **Fungsi bertipe daftar** menangkap kegagalan provider/database agar route
  dapat dirender. `searchCVEs` menandai `available: false` saat query gagal;
  halaman pencarian menampilkan status katalog tidak tersedia dan tidak
  menyebutnya sebagai pencarian tanpa hasil. Facet dan daftar ringkas mencatat
  kegagalan di log server. Dashboard juga menampilkan keadaan data belum
  tersedia, bukan angka nol yang dianggap hasil valid.
- **`getCVEById`** membedakan dua kondisi: NVD memastikan ID tidak ada
  (0 hasil) → mengembalikan `null`, alur `notFound()` yang sudah ada di
  `app/cve/[id]/page.tsx` tetap bekerja tanpa perubahan. Kegagalan lain
  (jaringan/timeout/server) → melempar `NvdApiError` yang seharusnya
  ditangkap `app/error.tsx`.
- **Catatan dari pengujian:** di lingkungan pengembangan proyek ini,
  perilaku pelemparan error dari rute dinamis (`app/cve/[id]/page.tsx`)
  ke `app/error.tsx` saat request time tidak selalu konsisten dengan
  dokumentasi Next.js (halaman kadang menampilkan konten "tidak ditemukan"
  alih-alih boundary error, meski error sudah tercatat di log server) —
  reproduksi minimal mengonfirmasi ini bukan disebabkan oleh kode NVD di
  proyek ini, melainkan perilaku Next.js/Turbopack untuk skenario spesifik
  ini. Sebagai langkah aman, halaman detail CVE sekarang **juga** menangkap
  error secara eksplisit dan merender `<ErrorState>` inline, tidak
  bergantung sepenuhnya pada mekanisme boundary otomatis. Kalau perilaku
  Next.js ini berubah di versi mendatang (atau ternyata bekerja normal di
  lingkungan produksi sungguhan seperti Vercel), penanganan eksplisit ini
  tetap aman untuk dipertahankan sebagai lapisan cadangan.

## 8. Sinkronisasi terjadwal dan cache

Vercel Cron memanggil `GET /api/sync` harian dengan `Authorization: Bearer
<CRON_SECRET>`. Sinkronisasi manual memakai `POST /api/sync` dan
`ADMIN_SECRET`. Kedua jalur gagal tertutup bila secret hilang atau salah.
Rate pacing NVD hanya berjalan pada job sinkronisasi.

Antrean terjemahan berjalan melalui Cron terpisah pada `GET /api/translations`.
Route mengklaim hingga 512 deskripsi per putaran dengan maksimal 32 teks dan
60.000 karakter sumber per request. Ia membatasi maksimal 8 request serentak,
timeout provider 4 detik, satu retry, dan budget kerja 42 detik; job yang tidak
masuk estimasi waktu dikembalikan ke antrean. Job `RUNNING` yang stale diklaim
kembali. Respons mencakup batch/request, waktu proses, antrean tersisa, dan status peringatan.

Katalog disimpan di Neon, bukan Next.js Data Cache. Feed CISA KEV besar
diambil dengan `no-store`. Cache antrean terjemahan berdasarkan hash deskripsi
disimpan di Neon dan diproses ulang dengan retry; deskripsi sumber tetap ada.

## 9. Sinkronisasi dan validasi operasional

Gunakan `npm run typecheck`, `npm run lint`, `npm run test`, dan `npm run
build` sebelum deploy. Untuk memastikan koneksi database, jalankan
`npm run test:neon` hanya dengan `TEST_DATABASE_URL` yang menunjuk ke branch
khusus pengujian. Jangan arahkan skrip integrasi ke database produksi.
