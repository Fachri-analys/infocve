# Kebijakan atribusi dan penggunaan data InfoCVE

**Pemeriksaan sumber: 31 Oktober 2026.** Dokumen ini merangkum ketentuan primer yang ditemukan untuk sumber yang sudah dipakai aplikasi. Ini catatan engineering, bukan nasihat hukum. Setiap feed atau record dapat berubah; cek halaman resmi sebelum menambah sumber atau melakukan redistribusi skala besar.

## Prinsip

- Jangan menyamakan akses API atau status publik dengan lisensi untuk menyalin dan mendistribusikan ulang seluruh isi sumber.
- Pertahankan ID sumber, URL record asli, waktu respons diterima/diproses, serta ketentuan lisensi yang diketahui pada UI dan ekspor.
- Labeli terjemahan, prioritas, dan rekomendasi yang dihasilkan InfoCVE sebagai analisis/transformasi InfoCVE. Jangan menyajikan teks terjemahan seolah ditulis atau disahkan sumber aslinya.
- Tautkan konten advisori ke sumber asal. Tautan vendor sendiri mengikuti ketentuan vendor tersebut; InfoCVE tidak mengambil atau menyalin halaman vendor sebagai isi advisori.
- Lisensi kode aplikasi di [`LICENSE`](../LICENSE) hanya berlaku untuk materi InfoCVE yang dicakup olehnya. Lisensi ini tidak mengubah hak atas data, library, logo, atau konten pihak lain.

## Sumber yang digunakan

| Sumber | Ketentuan yang diverifikasi | Atribusi dan batas penggunaan di InfoCVE | Status |
| --- | --- | --- | --- |
| [NVD/NIST API](https://nvd.nist.gov/developers/terms-of-use) | Ketentuan API meminta pemberitahuan bahwa produk memakai API NVD dan tidak didukung/disertifikasi NVD. Informasi pada situs NIST umumnya dapat disalin kecuali ditandai hak cipta, tetapi halaman NIST memperingatkan sebagian materi memiliki syarat sendiri. | Pertahankan nama dan URL record NVD; gunakan kalimat non-endorsement NVD pada README/halaman detail. CVE record juga tunduk pada [CVE Program Terms of Use](https://www.cve.org/Legal/TermsOfUse), yang mengizinkan penggunaan CVE dengan copyright designation dan lisensi MITRE tetap disertakan pada salinan CVE. Konten dari CNA/vendor yang ditautkan tidak otomatis menjadi konten NVD. | Aktif; jangan klaim satu lisensi blanket untuk semua teks record. |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | [Lisensi resmi mirror KEV](https://github.com/cisagov/kev-data/blob/develop/LICENSE) menyatakan data katalog di bawah CC0 1.0; tautan pihak ketiga di dalam katalog tetap mengikuti syarat masing-masing. Lisensi itu juga tidak memberikan hak memakai logo CISA/seal DHS atau menyiratkan endorsement. | Cantumkan CISA KEV dan tautan katalog/record. CC0 hanya dicatat untuk data katalog, tidak untuk konten halaman yang ditautkan. | Aktif; pemberian kredit tetap dilakukan sebagai praktik atribusi. |
| [FIRST EPSS](https://www.first.org/epss/faq) | FAQ menyebut skor tersedia gratis lewat API/CSV tanpa registrasi dan meminta atribusi pada publikasi/produk. FAQ [Get the Data](https://www.first.org/epss/data) membedakan lookup API dari unduhan data harian. Kami tidak menemukan lisensi dataset khusus pada sumber resmi yang ditinjau. | Sebut FIRST EPSS / Empirical Security, tautkan data/API, dan tampilkan tanggal skor bila tersedia. Jangan menyebut skor “public domain”, CC-BY, atau lisensi lain. Redistribusi bulk perlu pemeriksaan lebih lanjut. | Aktif untuk lookup dan tampilan skor; redistribusi massal: **Needs Review**. |
| [GitHub Advisory Database](https://github.com/advisories) | [Ketentuan GitHub untuk Advisory Database](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#advisory-database) menetapkan CC BY 4.0 dan menerima atribusi melalui link ke database atau advisori tertentu. Repo resmi memuat salinan [teks lisensi](https://github.com/github/advisory-database/blob/main/LICENSE.md). | Pertahankan GHSA ID, link record spesifik, atribusi GitHub Advisory Database, dan nyatakan materi diubah ketika diringkas/diterjemahkan. Referensi ke CNA/vendor tetap ditautkan terpisah. | Aktif; CC BY 4.0 dengan atribusi. |
| [OSV.dev](https://osv.dev) (scanner npm) | [Daftar sumber OSV](https://google.github.io/osv.dev/data/) menunjukkan lisensi data berbeda antar database, termasuk CC-BY, CC0, MIT, Apache, BSD, dan CC-BY-SA. OSV sendiri meminta setiap kontributor mendokumentasikan lisensi data sumbernya; ini bukan lisensi tunggal untuk semua respons API. | Simpan ID advisory OSV, GHSA bila tersedia, URL record, referensi upstream, waktu pengambilan, dan status lisensi. Jika sumber asal/license record tidak jelas, tampilkan **Needs Review**; jangan menyimpulkan izin redistribusi hanya dari akses API. | Aktif untuk pencarian/matching; hak redistribusi materi record harus ditinjau per asal. |
| Advisori vendor dan URL referensi | Ketentuan ditentukan masing-masing vendor/penerbit dan tidak seragam. | InfoCVE menampilkan link, identitas host/sumber, dan fakta/rentang seperlunya; tidak melakukan fetch, mirror, atau menyalin seluruh teks halaman vendor ke laporan. Rujukan tidak berarti InfoCVE memiliki atau mengesahkan materi tersebut. | Pemeriksaan per penerbit masih diperlukan. |
| Provider terjemahan (`INFOCVE_TRANSLATION_URL`) | Provider tidak ditetapkan atau dibundel oleh repository; konfigurasi dapat menunjuk layanan berbeda dengan ketentuan dan kebijakan data masing-masing. | Operator deployment harus memeriksa Terms/Privacy dan izin pengiriman deskripsi CVE sebelum mengaktifkannya. UI menandai output sebagai terjemahan yang diproses melalui provider; identitas endpoint/API key tidak diekspos ke browser. | **Needs Review per konfigurasi** sebelum penggunaan produksi. |

Sumber resmi tambahan: [Pernyataan hak cipta NIST](https://www.nist.gov/copyrights-disclaimers). NIST menyatakan informasi situsnya umumnya dapat disalin kecuali materi berhak cipta dan meminta kredit yang sesuai; pernyataan umum tersebut tidak menghapus hak pihak ketiga yang materinya termuat/ditautkan.

## Cara atribusi diterapkan

### Detail CVE dan terjemahan

Halaman detail menautkan record NVD dan referensi asli. Waktu yang ditampilkan adalah saat respons diproses oleh InfoCVE; NVD/API dapat mengembalikan respons cache Next.js (detail CVE memiliki jendela revalidasi enam jam), sehingga itu bukan bukti waktu unduh origin. Tanggal modifikasi dari sumber tetap metadata terpisah. Terjemahan otomatis menyebut NVD sebagai sumber teks asli dan InfoCVE sebagai pembuat terjemahan.

Pernyataan non-endorsement NVD: “This product uses the NVD API but is not endorsed or certified by the NVD.” InfoCVE bukan produk resmi/tersertifikasi NVD.

### Pemindai, mitigasi, verifikasi, dan ekspor

Setiap temuan scanner membawa source ID/advisory ID, URL record, waktu fetch, tanggal modifikasi record bila ada, paket/rentang yang dievaluasi, dan alasan keputusan. UI membedakan keterangan dari advisori dengan prioritas/perintah upgrade analisis InfoCVE. PDF/JSON mempertahankan bukti, konflik, status verifikasi, peringatan, keterbatasan, link atribusi, dan status ketentuan `TERMS_IDENTIFIED`/`NEEDS_REVIEW`. Atribusi OSV menyatakan lisensi per-record mengikuti database asal; GHSA ditautkan secara terpisah. Vendor reference hanya provenance: halaman vendor tidak di-fetch dan statusnya `NEEDS_REVIEW` sampai penerbit ditinjau.

Waktu scan pada report adalah waktu analisis. Setiap `sourceEvidence` menyimpan timestamp serta `observationType`: respons advisory, pemeriksaan snapshot lokal, URL referensi saja (halaman vendor tidak di-fetch), atau lookup yang tidak mengembalikan record. Timestamp respons OSV/GHSA adalah saat respons diproses; timestamp NVD lokal adalah saat snapshot diperiksa, bukan waktu sinkronisasi NVD. Timestamp ini bukan waktu publikasi upstream; tanggal modifikasi sumber ditampilkan terpisah jika tersedia.

## Inventaris library dan dependency

[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) dihasilkan dari `package-lock.json` versi terkunci dan metadata paket yang tersedia. Ia mencatat setiap dependency langsung/transitif termasuk versi, jenis penggunaan, deklarasi repository, author yang dinyatakan, copyright line pada notice bila ditemukan, lisensi, link metadata npm, serta salinan file LICENSE/NOTICE yang ditemukan lokal.

Jalankan ulang setelah mengubah lockfile:

```bash
node scripts/generate-third-party-notices.mjs
```

Nilai `author`/`repository` dari metadata paket belum diverifikasi sebagai pemilik hak cipta. Paket yang tidak menyediakan metadata/file notice lokal ditandai **Needs Review**; ini bukan pernyataan bahwa paket tersebut tidak memiliki hak cipta atau kewajiban lisensi. Periksa notice pada artifact untuk platform yang benar sebelum mendistribusikan bundle atau installer.

## Temuan kepatuhan dan pemeriksaan lanjutan

1. EPSS tidak menunjukkan lisensi dataset eksplisit pada FAQ/data page yang ditinjau; atribusi diterapkan dan bulk redistribution tetap ditahan untuk pemeriksaan.
2. OSV mengagregasi record dengan ketentuan upstream campuran. Scanner saat ini mempertahankan identitas dan link OSV/GHSA/vendor serta timestamp; untuk record yang asal/lisensinya belum diketahui, status hak redistribusi perlu dianggap **Needs Review**. Jangan mengekspor ulang koleksi advisori secara massal tanpa pemeriksaan sumber.
3. Link advisori vendor membawa pengguna ke situs penerbit dan tetap di bawah ketentuan masing-masing. Halaman yang belum ditinjau tidak digunakan sebagai sumber teks yang disalin.
4. Inventaris npm dibuat dari lockfile dan metadata yang tersedia di mesin saat generator dijalankan. Ia bukan legal clearance; baris **Needs Review** perlu dituntaskan sebelum distribusi binary/bundle yang relevan.
5. Logo, merek, dan endorsement sumber eksternal tidak disertakan sebagai identitas InfoCVE. Nama sumber hanya untuk atribusi dan penjelasan provenance.

Pada snapshot dependency **31 Oktober 2026**, `THIRD_PARTY_NOTICES.md` berisi 529 versi terkunci; 222 paket masih ditandai **Needs Review** karena metadata author/repository/copyright/notice belum lengkap di instalasi lokal. Ini belum membuktikan pelanggaran lisensi, tetapi kepemilikan dan kewajiban distribusi paket-paket itu belum tervalidasi penuh. Tinjau semuanya sebelum menerbitkan artifact yang membundel dependency; lihat alasan per paket pada inventaris. Tidak ada dependency baru yang ditambahkan oleh perubahan kepatuhan ini.

Snapshot yang sama memuat **25 entri MPL-2.0** di dependency development (Lightning CSS dan `axe-core`) serta **14 entri LGPL-3.0-or-later** pada paket opsional Sharp/libvips khusus platform. Ini bukan temuan pelanggaran: periksa apakah paket tersebut masuk artifact yang benar-benar didistribusikan. Bila iya, ikuti [MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/) (termasuk ketentuan source form saat mendistribusikan executable) atau [LGPL 3.0](https://www.gnu.org/licenses/lgpl-3.0.html) yang berlaku, dan sertakan notice yang diwajibkan. Paket opsional yang tidak terpasang pada mesin ini masih perlu diperiksa dari registry/source resmi untuk target deployment.

Diperiksa terakhir: **31 Oktober 2026**. Periksa ulang ketentuan resmi ketika integrasi, cara ekspor, atau kebijakan sumber berubah.
