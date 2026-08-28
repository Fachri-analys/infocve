# Panduan Kontribusi InfoCVE (Contributing Guide)

Terima kasih atas minat Anda untuk berkontribusi pada **InfoCVE**! Proyek ini bertujuan menyediakan basis pengetahuan kerentanan siber terlengkap dan mudah dipahami dalam Bahasa Indonesia.

---

## 🛠️ Persyaratan Lingkungan Pengembangan

- **Node.js**: `v20.9.0` atau yang lebih baru
- **Package Manager**: `npm` (v10+)
- **Git**

---

## 🚀 Memulai Proyek Secara Lokal

1. **Clone repositori**:
   ```bash
   git clone https://github.com/fachri/infocve.git
   cd infocve
   ```

2. **Instal dependensi**:
   ```bash
   npm install
   ```

3. **Salin berkas konfigurasi lingkungan**:
   ```bash
   cp .env.example .env.local
   ```

4. **Jalankan server pengembangan**:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

---

## 🧪 Pengujian & Kualitas Kode

Sebelum membuat Pull Request, pastikan seluruh tahapan verifikasi lulus tanpa error:

```bash
# 1. Jalankan unit test
npm test

# 2. Cek type-safety TypeScript
npm run typecheck

# 3. Jalankan linter ESLint
npm run lint

# 4. Uji build produksi
npm run build
```

---

## 📜 Prinsip Pengembangan

1. **Keamanan & Validasi Input**: Jangan pernah merender URL eksternal tanpa validasi protokol (`http:` / `https:`).
2. **Kerahasiaan Secret**: Kunci API server-side (`NVD_API_KEY`, `GITHUB_TOKEN`) tidak boleh diekspos ke client-side bundle (`NEXT_PUBLIC_*`).
3. **Tanpa Eksekusi PoC**: InfoCVE adalah platform metadata intelijen. Jangan pernah mengeksekusi payload exploit pihak ketiga.
4. **Backward Compatibility**: Pertahankan fungsionalitas Server Components dan struktur routing Next.js App Router.
