# Dokumentasi Komponen

Komponen dikelompokkan per domain, bukan diletakkan datar dalam satu folder:

- `components/ui/` — primitif dasar (Button, Card, Input, dst.), gaya shadcn/ui, tanpa pengetahuan tentang CVE.
- `components/cve/` — komponen yang tahu bentuk data `CVE`.
- `components/search/` — komponen pencarian & filter.
- `components/common/` — komponen lintas domain (breadcrumb, skeleton, empty/error/404 state).
- `components/layout/` — navbar, footer, dan bagian shell halaman lainnya.

Di bawah ini beberapa komponen kunci beserta cara pakainya.

## `<SeverityBadge />`

```tsx
import { SeverityBadge } from "@/components/cve/severity-badge";

<SeverityBadge severity="CRITICAL" />
<SeverityBadge severity="HIGH" size="sm" showDot={false} />
```

| Prop | Tipe | Default | Keterangan |
|---|---|---|---|
| `severity` | `"CRITICAL" \| "HIGH" \| "MEDIUM" \| "LOW" \| "NONE"` | — | Wajib |
| `size` | `"sm" \| "md"` | `"md"` | |
| `showDot` | `boolean` | `true` | Titik warna kecil di sebelah label |

Warna diatur terpusat di `utils/severity.ts` (`SEVERITY_CLASSES`) — ubah di
satu tempat itu untuk memengaruhi seluruh aplikasi.

## `<CVECard cve={cve} />`

Kartu ringkas untuk grid hasil pencarian & bagian homepage. Seluruh kartu
bisa diklik (menuju `/cve/[id]`) kecuali tombol salin ID yang menghentikan
propagasi klik.

## `<CVSSCard cvss={cve.cvss} />`

Menampilkan skor CVSS beserta penjelasan Bahasa Indonesia untuk setiap
metrik (Attack Vector, Attack Complexity, dst.). Teks penjelasan berasal
dari `lib/cvss-explanations.ts` — tambahkan/ubah kalimat di sana, bukan di
komponennya.

## `<SearchFilters />`

Formulir `<form method="GET">` biasa — bekerja tanpa JavaScript. Opsi
vendor/produk/tahun/CWE diberikan lewat props (diambil dari `lib/nvd.ts` di
level halaman), sehingga komponen ini tidak melakukan fetching sendiri.
Mencakup filter rentang tanggal (publikasi & pembaruan) lewat sub-komponen
lokal `<DateRangeFieldset>` yang dipakai dua kali, alih-alih menduplikasi
markup input "dari/sampai" di dua tempat.

## `<Pagination />`

Menerima `searchParams` mentah dari halaman dan membangun ulang URL untuk
tiap nomor halaman sambil mempertahankan filter aktif. Murni Link, tanpa
state React.

## Pola "state" bersama

`<EmptyState />`, `<ErrorState />`, dan `<NotFoundState />` semuanya
dibangun di atas `<StateMessage />` (`components/common/state-message.tsx`)
agar tidak ada logika tata letak yang terduplikasi antara ketiganya.

## Menambah komponen shadcn/ui baru

CLI resmi (`npx shadcn@latest add <nama>`) butuh akses ke `ui.shadcn.com`,
yang tidak tersedia di lingkungan sandbox tempat proyek ini pertama kali
dibuat — karena itu primitif di `components/ui/` ditulis manual mengikuti
pola resmi shadcn/ui (lihat `components.json` untuk konfigurasinya). Di
lingkungan dengan akses internet penuh, CLI tersebut bisa dipakai seperti
biasa untuk menambah komponen baru.
