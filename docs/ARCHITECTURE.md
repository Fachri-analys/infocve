# Arsitektur Platform InfoCVE

InfoCVE mengadopsi pola arsitektur **Multi-Source Vulnerability Intelligence & Anti-Corruption Layer** yang tangguh, aman, dan efisien.

---

## 🏛️ Diagram Alur Data

```
┌─────────────────────────────────────────────────────────────┐
│                    Sumber Data Intelijen                    │
├───────────────┬──────────────┬──────────────┬───────────────┤
│ NVD REST API  │   CISA KEV   │  FIRST EPSS  │    GitHub     │
│     v2.0      │   Catalog    │     API      │  Advisories   │
└───────┬───────┴──────┬───────┴──────┬───────┴───────┬───────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Source Adapters Layer                     │
│  (lib/sources/nvd, cisa-kev, epss, ghsa, poc-classifier)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Threat Intelligence Aggregator                  │
│       - Resolusi Konflik & Pengayaan Multi-Sumber           │
│       - Audit Jejak Asal Data (Provenance Tracking)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐ ┌───────────────────────────┐
│     Local SQLite Database    │ │    Notification Engine    │
│  (WAL Mode, Zero Dependency) │ │   (Webhook Alerts ON/OFF) │
└──────────────┬───────────────┘ └───────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                 App Router & UI Presentation                │
│    - Server Components (Search, CVE Detail, Homepage)       │
│    - Multi-Source Badges, CISA KEV Alerts, EPSS Meter       │
│    - Local AI Agent Interface (SBOM Scanner / Tool API)     │
└─────────────────────────────────────────────────────────────┘
```

### Penyimpanan sesuai lingkungan

- **Pengembangan dan self-hosting:** SQLite (`node:sqlite`) menyimpan katalog sinkronisasi lokal serta data aplikasi pada disk host.
- **Vercel:** filesystem function bersifat sementara; katalog `infocve_cves`, cursor sinkronisasi, cache/antrean terjemahan, rate limit, dan riwayat scanner disimpan di Neon.
- `GET /api/sync` yang dilindungi `CRON_SECRET` menjalankan backfill 120 hari dan sinkronisasi inkremental NVD. Satu invokasi menyimpan maksimal satu halaman 2.000 entri, lalu memperbarui cursor; lease di `infocve_sync_state` mencegah job berjalan bersamaan. EPSS memakai maksimal lima request paralel, sementara lookup CNA yang belum lengkap disimpan di `infocve_cna_queue` dan dibatasi 16 lookup per invokasi.
- Pencarian, jumlah total, facet, statistik, dan dashboard membaca agregat katalog Neon. Detail memakai Neon terlebih dahulu lalu NVD live sebagai fallback. Tanpa Neon, lingkungan lokal menggunakan SQLite.

---

## 🔒 Prinsip Desain Keamanan

1. **Anti-Corruption Layer**: Isolasi penuh antara struktur raw provider eksternal dengan internal model `types/cve.ts`.
2. **Zero Client Secret Exposure**: Seluruh kunci API (`NVD_API_KEY`, `GITHUB_TOKEN`, `ADMIN_SECRET`) beroperasi secara server-only.
3. **Strict URL & Protocol Validation**: Seluruh tautan eksternal divalidasi dengan protokol aman (`http:` / `https:`) untuk mencegah XSS (`javascript:`, `data:`).
4. **Metadata Only (No PoC Execution)**: Platform hanya mengidentifikasi dan mengkatalogkan metadata referensi eksploit tanpa pernah mengeksekusi payload.
