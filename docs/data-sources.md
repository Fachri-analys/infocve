# Pemeriksaan Legalitas, Ketentuan Layanan, & Aturan Redistribusi Sumber Kerentanan (Data Sources Audit)

Dokumen ini mendokumentasikan hasil audit kepatuhan (*compliance review*) terhadap Terms of Service (ToS), API Terms, Lisensi, Acceptable Use Policy (AUP), batas laju (*rate limit*), mekanisme autentikasi, aturan *caching*, atribusi (*attribution*), dan izin redistribusi data dari sumber-sumber intelijen kerentanan resmi.

---

## 1. Prinsip Kepatuhan InfoCVE

1. **Anti-Scraping Policy**: InfoCVE **tidak** menggunakan web scraping jika API resmi tersedia, atau jika ketentuan layanan (ToS) melarang scraping atau automasi tanpa izin.
2. **Strict Licensing Basis**: Tidak ada asumsi bahwa suatu data bebas digunakan tanpa dasar hukum tertulis dari dokumentasi resmi, lisensi terbuka (Public Domain, CC0, CC-BY, MIT, Apache 2.0), atau ketentuan API resmi.
3. **Pencegahan Kebocoran Kredensial**: Semua token/kunci API pihak ketiga wajib tersimpan di server/local environment (`server-only`) dan tidak pernah dikirimkan ke client atau tercatat di repositori publik.
4. **Klasifikasi Status**:
   - `APPROVED (ACTIVE)`: Sumber resmi aktif yang telah diuji dan mematuhi seluruh ketentuan.
   - `APPROVED (READY)`: Sumber resmi terverifikasi yang diizinkan untuk diintegrasikan pada tahap berikutnya.
   - `NEEDS REVIEW`: Sumber dengan batasan redistribusi ketat, izin bersyarat, atau kebijakan yang belum jelas. **Dilarang diimplementasikan** hingga ada verifikasi/izin formal.
   - `PROHIBITED / EXCLUDED`: Sumber yang ToS-nya secara eksplisit melarang scraping, mirroring, atau redistribusi. **Dilarang diintegrasikan**.

---

## 2. Audit Sumber Aktif (Existing Sources)

### 2.1. National Vulnerability Database (NIST NVD)
- **Status:** `APPROVED (ACTIVE)`
- **Penyedia:** National Institute of Standards and Technology (NIST), Departemen Perdagangan AS.
- **Dokumentasi Resmi:** <https://nvd.nist.gov/developers/vulnerabilities>
- **Endpoint API:** `https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Lisensi Data:** Domain Publik (Karya Pemerintah Federal AS berdasarkan 17 U.S.C. § 105).
- **Ketentuan Penggunaan (AUP):**
  - Menggunakan API resmi v2.0 (tidak ada scraping).
  - Parameter tanggal wajib berpasangan (`pubStartDate`/`pubEndDate`) maksimal rentang 120 hari.
- **Autentikasi:**
  - Opsional: Kunci API dikirim melalui header `apiKey` (tidak melalui query string).
- **Rate Limit:**
  - Tanpa API Key: 5 permintaan per jendela 30 detik (IP-based).
  - Dengan API Key: 50 permintaan per jendela 30 detik.
  - *InfoCVE Client Limiter:* Proaktif dibatasi pada 45 req/30s (dengan key) dan 5 req/30s (tanpa key).
- **Caching:** Diizinkan dan sangat direkomendasikan untuk menghindari kelebihan beban server NIST.
- **Atribusi:** Dianjurkan menyebutkan NIST NVD sebagai sumber data.
- **Aturan Redistribusi:** Diizinkan sepenuhnya tanpa royalti (Public Domain).

---

### 2.2. CISA Known Exploited Vulnerabilities (KEV)
- **Status:** `APPROVED (ACTIVE)`
- **Penyedia:** Cybersecurity and Infrastructure Security Agency (CISA), Departemen Keamanan Dalam Negeri AS.
- **Dokumentasi Resmi:** <https://www.cisa.gov/known-exploited-vulnerabilities-catalog>
- **Endpoint API / Feed:** `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **Lisensi Data:** CC0 1.0 Universal (Public Domain Dedication) melalui repositori resmi `cisagov/kev-data`.
- **Ketentuan Penggunaan (AUP):** Feed resmi disediakan gratis untuk publik dan komunitas keamanan siber dunia.
- **Autentikasi:** Tidak diperlukan (Public JSON feed).
- **Rate Limit:** Dilayani melalui CDN; polling disarankan berkala (misal: setiap 1 hingga 4 jam).
- **Caching:** Diizinkan & direkomendasikan (InfoCVE menerapkan TTL cache 4 jam).
- **Atribusi:** Memberikan atribusi kepada CISA KEV Catalog.
- **Aturan Redistribusi:** Bebas didistribusikan ulang (Public Domain / CC0).

---

### 2.3. FIRST Exploit Prediction Scoring System (EPSS)
- **Status:** `APPROVED (ACTIVE)`
- **Penyedia:** Forum of Incident Response and Security Teams (FIRST.org) & Empirical Security.
- **Dokumentasi Resmi:** <https://www.first.org/epss/api>
- **Endpoint API:** `https://api.first.org/data/v1/epss`
- **Lisensi Data:** FIRST Open Data Policy.
- **Ketentuan Penggunaan (AUP):**
  - Akses publik gratis tanpa pendaftaran.
  - Dirancang untuk integrasi produk keamanan, dashboard, dan otomatisasi prioritas kerentanan.
- **Autentikasi:** Tidak memerlukan API key.
- **Rate Limit:** Fair-use policy. Mendukung multi-CVE batch query (misal: `?cve=CVE-...,CVE-...`).
- **Caching:** Skor EPSS diperbarui satu kali per hari (UTC), sehingga caching harian sangat disarankan.
- **Atribusi:** **Wajib / Sangat Dimohon**: Menyertakan kredit bahwa data skor berasal dari FIRST EPSS (<https://www.first.org/epss>).
- **Aturan Redistribusi:** Diizinkan dalam platform/dashboard intelijen dengan mencantumkan atribusi resmi.

---

### 2.4. GitHub Security Advisories (GHSA)
- **Status:** `APPROVED (ACTIVE)`
- **Penyedia:** GitHub, Inc.
- **Dokumentasi Resmi:** <https://docs.github.com/en/rest/security-advisories> & <https://github.com/advisories>
- **Endpoint API:** `https://api.github.com/advisories` (REST) & GitHub GraphQL API.
- **Lisensi Data:** Creative Commons Attribution 4.0 International (CC-BY-4.0).
- **Ketentuan Penggunaan (AUP):** Tunduk pada GitHub Acceptable Use Policies dan GitHub API Terms.
- **Autentikasi:**
  - Opsional namun disarankan: GitHub Personal Access Token (`Bearer <token>`).
- **Rate Limit:**
  - Autentikasi: 5.000 permintaan per jam.
  - Tanpa autentikasi: 60 permintaan per jam.
- **Caching:** Diizinkan.
- **Atribusi:** **Wajib** berdasarkan lisensi CC-BY-4.0. Harus menyertakan tautan ke basis data penasihat GitHub (`https://github.com/advisories`) atau URL penasihat spesifik (`GHSA-...`).
- **Aturan Redistribusi:** Diizinkan secara komersial dan non-komersial selama atribusi dipenuhi dan perubahan ditandai.

---

## 3. Audit Sumber Potensial Tambahan (Candidate Sources)

### 3.1. OSV.dev (Open Source Vulnerabilities)
- **Status:** `APPROVED (READY)`
- **Penyedia:** Open Source Security Foundation (OpenSSF) & Google.
- **Dokumentasi Resmi:** <https://google.github.io/osv.dev/api/> dan <https://osv.dev>
- **Endpoint API:** `https://api.osv.dev/v1/vulns/{id}` dan `POST https://api.osv.dev/v1/query`
- **Lisensi Data:** Skema & infrastruktur OSV berlisensi Apache 2.0. Data individual mengikuti lisensi upstream (sebagian besar CC-BY 4.0).
- **Ketentuan Penggunaan (AUP):** Disediakan sebagai layanan publik gratis untuk ekosistem open source.
- **Autentikasi:** Tidak ada kunci API yang diperlukan.
- **Rate Limit:** Sangat longgar (tidak ada hard rate limit yang membatasi penggunaan wajar). Batas ukuran payload respons 32 MiB pada HTTP/1.1 (disarankan HTTP/2).
- **Caching:** Diizinkan.
- **Atribusi:** Wajib mencantumkan atribusi ke OSV.dev dan sumber data asal paket.
- **Aturan Redistribusi:** Diizinkan secara luas untuk integrasi keamanan.
- **Rekomendasi InfoCVE:** Sangat direkomendasikan sebagai adapter berikutnya untuk memperkaya data paket open-source (npm, PyPI, Go, Maven, dll.).

---

### 3.2. CVE.org / CVE Services / cvelistV5 (The CVE Program)
- **Status:** `APPROVED (READY)`
- **Penyedia:** CVE Program (didukung oleh The MITRE Corporation dan CISA).
- **Dokumentasi Resmi:** <https://www.cve.org/Legal/TermsOfUse> & <https://github.com/CVEProject/cvelistV5>
- **Mekanisme Akses:**
  - Repositori git resmi `cvelistV5` (format resmi CVE JSON 5.0).
  - CVE Services REST API (`https://cveawg.mitre.org/api/cve/`).
- **Lisensi Data:** CVE Program Terms of Use (Bebas untuk dicari, diunduh, dan dimasukkan ke dalam produk/layanan).
- **Ketentuan Penggunaan (AUP):** Menggunakan data resmi JSON 5.0. Format lama (CSV, XML, HTML) telah dihentikan sejak Juni 2024.
- **Autentikasi:** Read-only pada repositori GitHub cvelistV5 tidak memerlukan kredensial khusus.
- **Rate Limit:** Mengikuti batasan GitHub API jika menggunakan API GitHub.
- **Caching:** Diizinkan.
- **Atribusi:** "CVE" adalah merek dagang terdaftar milik The MITRE Corporation. Penggunaan nama harus menghormati panduan merek dagang.
- **Aturan Redistribusi:** Diizinkan.

---

### 3.3. Red Hat Security Data API
- **Status:** `APPROVED (READY)`
- **Penyedia:** Red Hat Product Security.
- **Dokumentasi Resmi:** <https://access.redhat.com/documentation/en-us/red_hat_security_data_api/>
- **Endpoint API:** `https://access.redhat.com/hydra/rest/securitydata/cve/{cveId}.json`
- **Lisensi Data:** Open Data / Creative Commons Attribution 4.0 International (CC-BY 4.0).
- **Ketentuan Penggunaan (AUP):** Tersedia secara gratis untuk publik untuk memantau keamanan paket Linux / Enterprise.
- **Autentikasi:** Tidak diperlukan.
- **Rate Limit:** Fair-use policy.
- **Caching:** Diizinkan.
- **Atribusi:** Wajib mencantumkan Red Hat Product Security sebagai sumber penilaian.
- **Aturan Redistribusi:** Diizinkan dengan lisensi CC-BY 4.0.

---

### 3.4. GitLab Advisory Database
- **Status:** `APPROVED (READY)`
- **Penyedia:** GitLab Inc.
- **Dokumentasi Resmi:** <https://gitlab.com/gitlab-org/advisories-community>
- **Lisensi Data:** MIT License.
- **Ketentuan Penggunaan (AUP):** Repositori publik open source yang berisi advisory kerentanan.
- **Autentikasi:** Tidak diperlukan untuk git clone / download raw feed.
- **Rate Limit:** GitLab raw file download rate limits.
- **Caching:** Diizinkan.
- **Atribusi:** Menyertakan pemberitahuan hak cipta MIT.
- **Aturan Redistribusi:** Diizinkan di bawah lisensi MIT.

---

## 4. Sumber dengan Batasan / Perlu Peninjauan Khusus (NEEDS REVIEW)

### 4.1. VulnCheck Community API
- **Status:** `NEEDS REVIEW`
- **Penyedia:** VulnCheck Inc.
- **Dokumentasi Resmi:** <https://docs.vulncheck.com/>
- **Ketentuan Lisensi & Masalah Redistribusi:**
  - Syarat Layanan Standar VulnCheck secara tegas **melarang** penyediaan "Service Data" secara gratis atau di bawah lisensi open source kepada pihak ketiga.
  - VulnCheck memberikan pengecualian khusus untuk dataset **VulnCheck KEV** dan **NVD++** agar dapat digunakan secara komersial/open source, namun mewajibkan pelabelan publik yang sangat mencolok (*prominent public attribution*).
  - Produk intelijen lainnya (eksploit dan data akses awal) berada di bawah kontrak berbayar eksklusif.
- **Alasan Penahanan:** Adanya risiko pelanggaran klausul redistribusi jika dataset selain KEV/NVD++ tercampur atau terindeks ke dalam basis data terbuka tanpa lisensi komersial enterprise.
- **Tindakan:** **JANGAN DIIMPLEMENTASIKAN** hingga ada konfirmasi tertulis bahwa penggunaan InfoCVE hanya mencakup feed KEV/NVD++ dan format atribusi telah disetujui.

---

### 4.2. Exploit-DB (OffSec)
- **Status:** `NEEDS REVIEW / EXCLUDED (NO SCRAPING)`
- **Penyedia:** Offensive Security (OffSec).
- **Dokumentasi Resmi:** <https://www.exploit-db.com/> & <https://gitlab.com/exploit-database/exploitdb>
- **Ketentuan Lisensi & Masalah Penggunaan:**
  - Ketentuan Layanan (ToS) `exploit-db.com` secara tegas **melarang scraping** dan pengambilan data otomatis tanpa izin tertulis.
  - OffSec menyediakan arsip file CSV resmi untuk perkakas lokal (`searchsploit`).
  - Menyimpan dan mendistribusikan ulang kode eksploit mentah (*raw exploit proof-of-concept*) memiliki implikasi hukum hak cipta pembuat eksploit dan kebijakan anti-malware hosting platform.
- **Tindakan:** **JANGAN MELAKUKAN SCRAPING**. Hanya gunakan klasifikasi metadata URL referensi (seperti yang saat ini sudah berjalan pada `poc-classifier.ts`) tanpa melakukan crawling atau re-hosting konten eksploit.

---

## 5. Sumber yang Dilarang Keras (PROHIBITED / EXCLUDED)

### 5.1. Snyk Vulnerability Database
- **Status:** `PROHIBITED / EXCLUDED`
- **Ketentuan Layanan:**
  - Bagian Terms of Service Snyk secara eksplisit melarang:
    1. *Web scraping*, *crawling*, *spidering*, atau automasi terhadap situs atau basis data kerentanan Snyk.
    2. *Mirroring*, *framing*, menyalin (*copying*), mengunduh secara massal, atau mempublikasikan ulang (*republishing*) basis data kerentanan.
    3. Mendistribusikan ulang data kerentanan kepada pihak ketiga untuk tujuan komersial atau platform agregasi publik tanpa kontrak enterprise resmi.
- **Tindakan:** **DILARANG KERAS** melakukan scraping atau integrasi tidak resmi ke Snyk.

---

### 5.2. Packet Storm Security
- **Status:** `PROHIBITED / EXCLUDED`
- **Ketentuan Layanan:**
  - Tidak memiliki REST API publik berlisensi terbuka.
  - ToS melarang segala bentuk automated crawling/scraping data advisory dan eksploit.
- **Tindakan:** **DILARANG KERAS** melakukan scraping terhadap Packet Storm.

---

## 6. Matriks Evaluasi Sumber Kerentanan

| Sumber | Lisensi Data | API Resmi? | Scraping Diperlukan? | Autentikasi | Atribusi Wajib? | Status Kepatuhan |
|---|---|---|---|---|---|---|
| **NIST NVD** | Public Domain (17 U.S.C. § 105) | Ya (v2.0) | **Tidak** | Opsional (`apiKey`) | Dianjurkan | `APPROVED (ACTIVE)` |
| **CISA KEV** | CC0 1.0 Universal | Ya (JSON Feed) | **Tidak** | Tidak | Dianjurkan | `APPROVED (ACTIVE)` |
| **FIRST EPSS** | Open Data Policy | Ya (REST) | **Tidak** | Tidak | **Ya** | `APPROVED (ACTIVE)` |
| **GitHub Advisories** | CC-BY-4.0 | Ya (REST/GraphQL) | **Tidak** | Opsional (Token) | **Ya** (Link resmi) | `APPROVED (ACTIVE)` |
| **OSV.dev** | Apache 2.0 / CC-BY-4.0 | Ya (REST) | **Tidak** | Tidak | **Ya** | `APPROVED (READY)` |
| **CVE.org (JSON 5.0)** | CVE Terms of Use | Ya (Git / API) | **Tidak** | Opsional | **Ya** (Trademark) | `APPROVED (READY)` |
| **Red Hat Security** | CC-BY-4.0 / Open Data | Ya (REST) | **Tidak** | Tidak | **Ya** | `APPROVED (READY)` |
| **GitLab Advisories** | MIT | Ya (Git Repository) | **Tidak** | Tidak | **Ya** (Notice MIT) | `APPROVED (READY)` |
| **VulnCheck** | Proprietary Service Terms | Ya (Community API) | **Tidak** | Ya (API Key) | **Ya** (Prominent) | `NEEDS REVIEW` |
| **Exploit-DB** | Proprietary / Mixed | Hanya Git CSV | Dilarang ToS | Tidak | Ya | `NEEDS REVIEW` |
| **Snyk DB** | Hak Cipta Dilindungi ToS | Tidak Resmi | Dilarang ToS | Enterprise Only | - | `PROHIBITED` |
| **Packet Storm** | Hak Cipta Dilindungi ToS | Tidak Ada | Dilarang ToS | - | - | `PROHIBITED` |

---

## 7. Pedoman Implementasi Adapter Baru (Implementation Guidelines)

Sebelum mengimplementasikan adapter baru di `lib/sources/`:
1. **Verifikasi Status:** Pastikan sumber berstatus `APPROVED`. Jika berstatus `NEEDS REVIEW` atau `PROHIBITED`, integrasi tidak boleh dibuat.
2. **Warisi `BaseVulnerabilitySource`:** Gunakan kelas dasar dari `lib/sources/base.ts` untuk menjamin adanya rate limiting, isolasi konfigurasi, dan penanganan error standar.
3. **Penyimpanan Kredensial:** Jika sumber membutuhkan token (seperti GitHub Token atau kunci API di masa depan), selalu simpan di environment variable server (tanpa prefiks `NEXT_PUBLIC_`).
4. **Tampilkan Atribusi di Antarmuka:** Setiap adapter yang berstatus `APPROVED` dengan syarat atribusi wajib (seperti CC-BY-4.0 atau EPSS) harus memiliki link referensi atau label sumber resmi pada tampilan detail CVE / daftar kerentanan.
