# Contoh untuk uji Pemindai InfoCVE

Unggah sepasang `package.json` dan `package-lock.json` dari salah satu folder di bawah pada `/dependency-scanner`.

## Hasil yang diharapkan

- `rentan/`: `lodash@4.17.20` — terpengaruh **CVE-2021-23337** (versi terdampak `<4.17.21`). GitHub Advisory Database juga mencatat CVE lain pada rentang versi ini. Tautan: https://github.com/advisories/GHSA-35jh-r3h4-6jhm
- `aman/`: `lodash@4.18.1` — versi perbaikan menurut advisori Lodash yang lebih baru, termasuk CVE-2021-23337 dan advisory 2025–2026. Tautan: https://github.com/advisories/GHSA-r5fr-rjxr-66jc dan https://github.com/advisories/GHSA-f23m-r3pf-42rh

Gunakan kedua set untuk membandingkan deteksi rentan dan versi perbaikan. Status aman hanya berarti tidak ada advisori yang cocok ditemukan oleh sumber dan data yang tersedia saat pemindaian; itu bukan bukti bahwa paket atau seluruh aplikasi bebas dari kerentanan.

Pemindai melakukan pembacaan JSON statis. File demo ini minimal untuk uji upload dan tidak berisi kode aplikasi.
