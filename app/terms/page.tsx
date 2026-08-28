import type { Metadata } from "next";

import { Breadcrumb } from "@/components/common/breadcrumb";
import { buildPageMetadata } from "@/utils/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Syarat & Ketentuan",
  description: "Syarat dan ketentuan penggunaan InfoCVE.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Syarat & Ketentuan" }]} />

      <h1 className="font-display text-2xl font-medium text-foreground sm:text-3xl">Syarat & Ketentuan</h1>
      <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui: 30 Juli 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">1. Tujuan Layanan</h2>
          <p>
            InfoCVE adalah platform edukasi yang menyajikan informasi kerentanan keamanan siber (CVE) dengan bahasa
            yang mudah dipahami. Dengan mengakses situs ini, Anda menyetujui syarat dan ketentuan berikut.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">2. Bukan Nasihat Keamanan Profesional</h2>
          <p>
            Konten di InfoCVE bersifat edukatif dan disederhanakan agar mudah dipahami. Konten ini{" "}
            <strong className="text-foreground">tidak boleh dijadikan satu-satunya dasar</strong> pengambilan
            keputusan keamanan pada sistem produksi. Untuk keputusan mitigasi, penambalan, atau kepatuhan yang
            sesungguhnya, selalu rujuk sumber resmi seperti NVD, vendor terkait, atau tenaga profesional keamanan
            siber bersertifikat.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">3. Keakuratan Data</h2>
          <p>
            Data CVE yang ditampilkan diambil langsung dari NVD REST API v2.0 resmi, disimpan sementara (cache)
            selama beberapa jam untuk menjaga performa dan batas penggunaan API. Karena itu, data yang tampil bisa
            saja tertinggal beberapa jam dari catatan terbaru di NVD. Sebagian informasi tambahan seperti judul dan
            kategori CVE disusun secara otomatis oleh InfoCVE (bukan berasal langsung dari NVD) dan dapat tidak
            selalu presisi. Kami berupaya menjaga keakuratan informasi, tetapi tidak memberikan jaminan bahwa
            seluruh data selalu lengkap, terkini, atau bebas dari kesalahan.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">4. Penggunaan yang Wajar</h2>
          <p>
            Anda setuju untuk tidak menyalahgunakan situs ini, termasuk namun tidak terbatas pada: melakukan scraping
            otomatis dalam skala yang membebani layanan, mencoba mengakses bagian non-publik dari sistem, atau
            menggunakan konten situs ini untuk memfasilitasi aktivitas yang melanggar hukum.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">5. Hak Kekayaan Intelektual</h2>
          <p>
            Kode dan desain InfoCVE adalah milik pengelola proyek ini, kecuali dinyatakan lain. Nama produk, merek
            dagang, dan istilah teknis yang disebut (termasuk nama vendor dan produk pihak ketiga) tetap menjadi hak
            masing-masing pemiliknya.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">6. Tanpa Jaminan</h2>
          <p>
            Situs ini disediakan &quot;sebagaimana adanya&quot; tanpa jaminan dalam bentuk apa pun. Pengelola tidak
            bertanggung jawab atas kerugian yang timbul dari penggunaan atau ketidaktersediaan situs ini.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">7. Perubahan Ketentuan</h2>
          <p>Ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan berlaku sejak dipublikasikan di halaman ini.</p>
        </section>
      </div>
    </div>
  );
}
