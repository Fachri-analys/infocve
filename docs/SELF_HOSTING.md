# Panduan Self-Hosting InfoCVE

InfoCVE dirancang agar dapat di-host secara mandiri (*self-hosted*) dengan mudah dan ringan menggunakan basis data SQLite bawaan Node.js (`node:sqlite`) tanpa memerlukan database server eksternal seperti PostgreSQL atau MySQL.

---

## 📋 Prasyarat

- Server Linux (Ubuntu, Debian, AlmaLinux, Fedora, Arch) atau container Docker.
- **Node.js $\ge$ 22.5.0** (wajib untuk modul `node:sqlite`).
- Port HTTP/HTTPS terbuka (default port internal: 3000).

---

## 🏗️ 1. Menjalankan Langsung dengan Node.js

### Langkah 1: Kloning & Pasang Dependensi
```bash
git clone https://github.com/Fachri-analys/infocve.git
cd infocve
npm ci
```

### Langkah 2: Buat Konfigurasi Lingkungan (`.env.local`)
```bash
cp .env.example .env.local
```

Sesuaikan nilai di `.env.local`:
```env
# URL publik domain Anda
NEXT_PUBLIC_SITE_URL=https://infocve.domainanda.com

# Kunci API NVD (Opsional tapi direkomendasikan untuk menaikkan limit)
NVD_API_KEY=kunci_api_anda

# Token GitHub (Opsional, untuk feed GHSA)
GITHUB_TOKEN=token_github_anda

# Direktori penyimpanan basis data SQLite
INFOCVE_DATA_DIR=/var/lib/infocve/data

# Kunci Rahasia Admin untuk Endpoint Sinkronisasi (/api/sync)
ADMIN_SECRET=buat_token_acak_yang_aman

# Pengaturan Notifikasi Webhook (Opsional)
NOTIFICATIONS_ENABLED=false
NOTIFICATION_WEBHOOK_URL=
```

### Langkah 3: Kompilasi dan Jalankan
```bash
npm run build
npm run start
```

---

## 🛡️ 2. Konfigurasi Reverse Proxy (Nginx)

Untuk melayani aplikasi melalui port standar 80/443 dengan sertifikat SSL (HTTPS Let's Encrypt):

```nginx
server {
    listen 80;
    server_name infocve.domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📡 Endpoint Pemeliharaan

- **Health Check**: `GET /api/health`
  - Memeriksa uptime server, versi, status data sources, dan total record.
- **Trigger Sinkronisasi**: `POST /api/sync`
  - Header: `Authorization: Bearer <ADMIN_SECRET>`
  - Menjalankan sinkronisasi bertahap dari NVD, CISA KEV, dan EPSS.
