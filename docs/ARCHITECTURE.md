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
- **Vercel:** filesystem function bersifat sementara. Pencarian dan detail CVE mengambil NVD API; sampel statistik NVD maksimal 100 record disimpan di tabel Neon `infocve_nvd_facet_cache` dan dipakai ulang selama 7 hari. Riwayat scanner juga menggunakan Neon ketika `DATABASE_URL` atau `POSTGRES_URL` tersedia.
- Sinkronisasi `/api/sync` masih mengisi SQLite lokal, bukan katalog bersama Neon. Sampel statistik Neon bukan database katalog lengkap dan tidak menjadi sumber untuk pencarian CVE.
- Cache NVD Neon dipakai lintas function instance dan jadi fallback jika NVD sementara gagal. Tanpa database Neon, aplikasi tetap dapat meminta NVD secara langsung, tetapi tidak memiliki cache bersama yang persisten.

---

## 🔒 Prinsip Desain Keamanan

1. **Anti-Corruption Layer**: Isolasi penuh antara struktur raw provider eksternal dengan internal model `types/cve.ts`.
2. **Zero Client Secret Exposure**: Seluruh kunci API (`NVD_API_KEY`, `GITHUB_TOKEN`, `ADMIN_SECRET`) beroperasi secara server-only.
3. **Strict URL & Protocol Validation**: Seluruh tautan eksternal divalidasi dengan protokol aman (`http:` / `https:`) untuk mencegah XSS (`javascript:`, `data:`).
4. **Metadata Only (No PoC Execution)**: Platform hanya mengidentifikasi dan mengkatalogkan metadata referensi eksploit tanpa pernah mengeksekusi payload.
