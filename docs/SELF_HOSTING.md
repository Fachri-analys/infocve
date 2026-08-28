# Panduan Self-Hosting InfoCVE

InfoCVE dirancang agar dapat di-host secara mandiri (*self-hosted*) dengan mudah menggunakan basis data SQLite tertanam (*embedded*) yang tidak memerlukan server basis data eksternal.

---

## 🏗️ Opsi 1: Menjalankan Langsung dengan Node.js

### 1. Kloning & Pengaturan

```bash
git clone https://github.com/fachri/infocve.git
cd infocve
npm ci
```

### 2. Variabel Lingkungan (`.env.local`)

```env
# URL publik aplikasi
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Kunci API NVD (Opsional, untuk batas laju lebih tinggi)
NVD_API_KEY=your_nvd_api_key_here

# Token GitHub (Opsional, untuk integrasi GHSA)
GITHUB_TOKEN=your_github_personal_access_token

# Direktori penyimpanan basis data SQLite
INFOCVE_DATA_DIR=./data

# Pengaturan Notifikasi (Opsional)
NOTIFICATIONS_ENABLED=true
NOTIFICATION_WEBHOOK_URL=https://your-webhook-endpoint.com/cve-alerts

# Kunci Rahasia Admin untuk Endpoint Sinkronisasi Manual (/api/sync)
ADMIN_SECRET=your_super_secret_admin_token
```

### 3. Bangun & Jalankan

```bash
npm run build
npm run start
```

Aplikasi dan basis data lokal akan diinisialisasi otomatis di `./data/infocve.sqlite`.

---

## 📡 Endpoint API Pemeliharaan

- **Health Check**: `GET /api/health`
  - Mengembalikan status kesehatan aplikasi, versi, data sources, dan ringkasan metrik statistik.

- **Trigger Sinkronisasi**: `POST /api/sync`
  - Header: `Authorization: Bearer <ADMIN_SECRET>`
  - Memicu sinkronisasi berkala data terbaru dari NVD, CISA KEV, EPSS, dan GHSA.
