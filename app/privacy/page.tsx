import type { Metadata } from "next";

import { Breadcrumb } from "@/components/common/breadcrumb";
import { buildPageMetadata } from "@/utils/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Kebijakan Privasi",
  description: "Kebijakan privasi InfoCVE — data apa yang kami kumpulkan (dan tidak kami kumpulkan).",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Breadcrumb items={[{ label: "Kebijakan Privasi" }]} />

      <div className="page-intro">
        <p className="eyebrow mb-3 text-[10px]">Transparansi & kepercayaan</p>
        <h1 className="content-heading font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Kebijakan Privasi</h1>
        <p className="mt-3 text-sm text-muted-foreground">Terakhir diperbarui: 30 Juli 2026</p>
      </div>

      <div className="prose-info mt-10 space-y-8">
        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">1. Ringkasan</h2>
          <p>
            InfoCVE dirancang agar bisa digunakan tanpa membuat akun dan tanpa memberikan data pribadi apa pun. Kami
            tidak memiliki sistem login, tidak menjalankan analitik pihak ketiga, dan tidak menampilkan iklan.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">2. Data yang Kami Kumpulkan</h2>
          <p>Saat ini InfoCVE tidak mengumpulkan data pribadi apa pun dari pengunjung. Secara spesifik:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Tidak ada pendaftaran akun atau proses login.</li>
            <li>Tidak ada cookie pelacakan atau alat analitik pihak ketiga.</li>
            <li>Tidak ada formulir yang mengirimkan data ke server kami (fitur pencarian bekerja lewat parameter URL, bukan pengiriman data ke basis data).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">3. Penyimpanan Lokal di Perangkat Anda</h2>
          <p>
            Preferensi tampilan (mode terang/gelap) disimpan di <span className="data-tag text-foreground">localStorage</span> browser
            Anda sendiri agar pilihan tersebut diingat saat Anda kembali. Data ini tersimpan sepenuhnya di perangkat
            Anda, tidak pernah dikirim ke server kami, dan dapat dihapus kapan saja lewat pengaturan browser.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">4. Penyedia Hosting</h2>
          <p>
            Situs ini dihosting di Vercel, yang secara umum mencatat data teknis standar (seperti alamat IP dan
            log permintaan) untuk keperluan operasional dan keamanan infrastruktur, sesuai kebijakan privasi Vercel
            sendiri.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">5. Tautan Eksternal</h2>
          <p>
            Halaman detail CVE menautkan ke sumber eksternal seperti NVD, MITRE/CVE.org, dan CISA. Kami tidak
            bertanggung jawab atas praktik privasi situs-situs tersebut.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">6. Perubahan Kebijakan</h2>
          <p>
            Jika fitur seperti akun pengguna atau analitik ditambahkan di masa depan, kebijakan ini akan diperbarui
            terlebih dahulu untuk mencerminkan perubahan tersebut.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-medium text-foreground">7. Kontak</h2>
          <p>
            Pertanyaan seputar kebijakan ini dapat diajukan melalui kanal kontak yang tercantum di repositori kode
            sumber proyek ini.
          </p>
        </section>
      </div>
    </div>
  );
}
