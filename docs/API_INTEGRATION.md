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
- **Lisensi data:** domain publik (produk pemerintah AS).
- **Dokumentasi resmi:** <https://nvd.nist.gov/developers/vulnerabilities>

## 4. Strategi query — kenapa perlu "perencanaan"

UI pencarian aplikasi ini mendukung hal-hal yang **tidak bisa** langsung
dipetakan ke satu permintaan NVD: multi-pilih tingkat keparahan, filter
tahun, kategori (konsep buatan aplikasi ini, NVD tidak mengenalnya), dan
rentang tanggal yang mungkin lebih dari 120 hari.

`searchCVEs()` di `lib/nvd.ts` menanganinya dengan dua jalur:

1. **Jalur native-penuh** — jika semua filter yang diminta bisa dipetakan
   langsung ke parameter NVD (severity tunggal, CWE tunggal, satu rentang
   tanggal ≤120 hari, tanpa `year`/`category`), permintaan dikirim dengan
   `resultsPerPage`/`startIndex` yang sudah pas dengan halaman yang diminta,
   dan `totalResults` dari NVD dipakai apa adanya untuk paginasi — akurat
   dan efisien.
2. **Jalur ambil-lalu-saring** — jika ada filter yang NVD tidak bisa
   terapkan secara native (multi-severity, `year`, `category`, rentang
   tanggal ganda/terlalu lebar), aplikasi mengambil satu batch yang cukup
   besar (200 hasil) memakai parameter native apa pun yang tersedia,
   lalu menjalankan **pipeline filter lengkap yang sama** (query, severity,
   year, vendor, product, cwe, category, rentang tanggal) di memori —
   termasuk filter yang sebenarnya sudah diterapkan NVD, karena menerapkan
   ulang filter yang sudah benar tidak mengubah hasil dan menghindari bug
   dari salah menandai "sudah ditangani NVD".

Konsekuensinya: pada kombinasi filter yang kompleks, hasil pencarian
mencerminkan 200 CVE paling relevan dari NVD untuk permintaan itu, bukan
seluruh basis data NVD (yang berisi 200.000+ entri). Ini adalah trade-off
yang jujur untuk arsitektur tanpa basis data sendiri (sesuai batasan
proyek: "tidak ada database") — bukan bug, tapi konsekuensi yang perlu
diketahui.

`getCVEsByYear(year)` adalah pengecualian yang disengaja: karena ini fungsi
bernama eksplisit (bukan bagian dari filter gabungan), ia memecah satu
tahun menjadi ~4 jendela ±91 hari dan mengirim keempatnya paralel lewat
`Promise.all`, lalu menggabungkan hasilnya — lebih banyak permintaan
daripada filter `year` generik di `searchCVEs()`, tapi akurat untuk
keseluruhan tahun, bukan perkiraan dari satu batch.

## 5. Facet (vendor/produk/kategori/tahun/CWE) & statistik beranda

`getVendors`, `getProducts`, `getCategories`, `getAvailableYears`,
`getAvailableCWEs`, dan `getStats` semuanya berasal dari **satu** fetch
bersama (`getFacetSample()` di `lib/nvd.ts`): 2.000 CVE terbaru (120 hari
terakhir, `resultsPerPage` maksimum NVD), di-cache 6 jam. Karena keenamnya
memanggil `fetch()` dengan URL/parameter yang identik, cache `fetch` bawaan
Next.js otomatis men-dedup-nya menjadi satu permintaan jaringan sungguhan,
walau dipanggil dari 6 fungsi berbeda secara paralel di halaman beranda.

**Keterbatasan yang perlu disadari:** angka-angka ini merepresentasikan
"200 hari terakhir", bukan seluruh sejarah NVD — cocok dengan label UI-nya
sendiri ("CVE Terbaru", "Vendor Terbaru"), tapi jangan diperlakukan sebagai
statistik global. Kalau nanti dibutuhkan angka global yang akurat, satu-
satunya cara sungguhan adalah menyimpan salinan data NVD sendiri (mis. di
basis data) dan meng-agregasi dari situ — di luar cakupan proyek ini karena
spesifikasi awal secara eksplisit melarang basis data.

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
- **Nama CWE** — NVD hanya memberi ID (`CWE-79`), tidak pernah nama. Dicari
  di `lib/cwe-catalog.ts` (~70 CWE umum); ID yang tidak dikenal tetap
  tampil dengan label generik, bukan error.
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
- **Penjelasan Indonesia (`descriptionId`)** — ini paling penting untuk
  dipahami: kamus istilah (`lib/dictionary.ts`) **tidak bisa** menerjemahkan
  kalimat bebas berbahasa Inggris apa pun (itu bukan tugas kamus istilah
  tetap, dan proyek ini secara eksplisit melarang terjemahan AI). Yang
  dilakukan sebagai gantinya: memindai deskripsi resmi untuk istilah yang
  dikenali kamus (mis. "SQL Injection", "XSS") dan menyajikan penjelasan
  Indonesia untuk istilah-istilah itu secara jujur, bukan berpura-pura
  menerjemahkan seluruh paragraf. Kalau tidak ada istilah yang dikenali,
  pesannya mengatakan demikian secara terbuka dan mengarahkan ke halaman
  Glosarium.

## 7. Penanganan error

- **Fungsi bertipe daftar** (`searchCVEs`, `getLatestCVEs`, `getVendors`,
  dst.) **tidak pernah throw**. Kegagalan apa pun (jaringan, timeout, rate
  limit, respons tidak terduga) ditangkap secara internal, dicatat lewat
  `console.error`, dan mengembalikan hasil kosong/nol — supaya halaman yang
  memanggilnya (termasuk saat prerendering statis di `next build`) selalu
  bisa dirender lewat `<EmptyState>` yang sudah ada, bukan gagal total.
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

## 8. Caching & revalidasi

Semua permintaan memakai `fetch` bawaan Next.js dengan
`next: { revalidate, tags }`, bukan `no-store` — inilah pertahanan utama
terhadap rate limit di trafik nyata, di atas retry logic:

| Jenis data | Revalidasi |
|---|---|
| Detail satu CVE (`getCVEById`) | 6 jam |
| Pencarian & daftar (`searchCVEs`, `getLatestCVEs`, dst.) | 1 jam |
| Sampel facet (vendor/produk/kategori/tahun/CWE/statistik) | 6 jam |

Angka-angka ini konstanta biasa (`REVALIDATE` di `lib/nvd.ts`) — ubah
sesuai kebutuhan tanpa menyentuh logika lain.

## 9. Yang tidak berubah

Tipe di `types/cve.ts`, seluruh komponen di `components/`, dan struktur
setiap halaman di `app/` tidak disentuh oleh migrasi ini — semuanya sudah
bekerja terhadap bentuk `CVE` yang stabil, bukan terhadap sumber datanya.
Satu-satunya perubahan di luar `lib/nvd*.ts` adalah pada bagaimana
`app/cve/[id]/page.tsx` menentukan `generateStaticParams`/`dynamicParams`
dan menangani error (lihat §7), dan `app/sitemap.ts` (lihat README).
