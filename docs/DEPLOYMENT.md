# Panduan Deployment InfoCVE

Panduan deployment InfoCVE ke berbagai lingkungan produksi: server mandiri (VPS / Linux Server / Docker) dan platform serverless (Vercel).

---

## 🏗️ 1. Deployment ke Server Mandiri (VPS / Ubuntu / Debian / Docker)

Deployment ke server mandiri adalah opsi paling direkomendasikan karena basis data SQLite (`node:sqlite`) dapat disimpan di media penyimpanan permanen (*persistent volume*).

### Langkah-langkah:

1. **Persiapan Server**:
   Pastikan Node.js $\ge$ 22.5.0 dan Git terpasang:
   ```bash
   node -v # Harus v22.5.0 atau lebih tinggi
   ```

2. **Kloning Kode Sumber**:
   ```bash
   git clone https://github.com/Fachri-analys/infocve.git
   cd infocve
   npm ci
   ```

3. **Konfigurasi Lingkungan Produksi**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` dengan nilai domain produksi Anda:
   ```env
   NEXT_PUBLIC_SITE_URL=https://infocve.id
   NVD_API_KEY=kunci_api_nist_anda
   ADMIN_SECRET=buat_token_acak_panjang_untuk_sync
   INFOCVE_DATA_DIR=/var/data/infocve
   ```

4. **Build dan Jalankan**:
   ```bash
   npm run build
   npm run start
   ```

5. **Menjalankan di Latar Belakang (Process Manager)**:
   Gunakan `pm2` untuk menjaga aplikasi selalu aktif:
   ```bash
   npm install -g pm2
   pm2 start npm --name "infocve" -- start
   pm2 save
   pm2 startup
   ```

---

## ⚡ 2. Deployment ke Vercel (Serverless)

InfoCVE sepenuhnya kompatibel dengan platform Vercel.

### Langkah-langkah:

1. **Hubungkan Repositori ke Vercel**:
   - Buka [vercel.com](https://vercel.com) dan pilih **Add New → Project**.
   - Pilih repositori `Fachri-analys/infocve`.
   - Framework preset akan terdeteksi otomatis sebagai **Next.js**.

2. **Pengaturan Environment Variables**:
   Di tab **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SITE_URL` = `https://nama-proyek-anda.vercel.app` (atau domain kustom Anda).
   - `INFOCVE_DATA_DIR` = `/tmp` *(Wajib pada Vercel karena lingkungan serverless hanya memperbolehkan penulisan file pada direktori `/tmp`)*.
   - `NVD_API_KEY` (Opsional, untuk menaikkan limit kuota NIST).
   - `ADMIN_SECRET` (Opsional, untuk mengamankan trigger sync).

3. **Deploy**:
   - Klik tombol **Deploy**.
   - Halaman statis, ISR, dan dynamic route seperti `/cve/[id]` dan `/dashboard` akan di-deploy secara otomatis.

---

## 🔄 3. Menjalankan Sinkronisasi Terjadwal (Cron Job)

Untuk memperbarui data CVE terbaru ke dalam basis data secara berkala, Anda dapat memasang cron job di server atau GitHub Actions:

```bash
# Contoh cron job setiap 6 jam
0 */6 * * * curl -X POST https://domain-anda.com/api/sync -H "Authorization: Bearer <ADMIN_SECRET>" -H "Content-Type: application/json"
```
