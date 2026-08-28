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

---

## 🔒 Prinsip Desain Keamanan

1. **Anti-Corruption Layer**: Isolasi penuh antara struktur raw provider eksternal dengan internal model `types/cve.ts`.
2. **Zero Client Secret Exposure**: Seluruh kunci API (`NVD_API_KEY`, `GITHUB_TOKEN`, `ADMIN_SECRET`) beroperasi secara server-only.
3. **Strict URL & Protocol Validation**: Seluruh tautan eksternal divalidasi dengan protokol aman (`http:` / `https:`) untuk mencegah XSS (`javascript:`, `data:`).
4. **Metadata Only (No PoC Execution)**: Platform hanya mengidentifikasi dan mengkatalogkan metadata referensi eksploit tanpa pernah mengeksekusi payload.
