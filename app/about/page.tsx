import type { Metadata } from "next";
import { BookOpen, Database, Languages, ShieldCheck } from "lucide-react";

import { Breadcrumb } from "@/components/common/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPageMetadata } from "@/utils/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Tentang",
  description: "Tentang InfoCVE — misi, cara kerja, dan batasan proyek edukasi kerentanan siber ini.",
  path: "/about",
});

const values = [
  {
    icon: Languages,
    title: "Bahasa yang Mudah Dipahami",
    description: "Istilah teknis dijelaskan dengan Bahasa Indonesia yang sederhana, tanpa menghilangkan istilah aslinya.",
  },
  {
    icon: Database,
    title: "Terjemahan Berbasis Kamus",
    description: "Label dan penjelasan umum diterjemahkan lewat kamus istilah yang disusun manual — bukan hasil AI.",
  },
  {
    icon: ShieldCheck,
    title: "Independen & Non-Komersial",
    description: "Tidak ada iklan, akun pengguna, atau pelacakan. InfoCVE murni untuk tujuan edukasi.",
  },
  {
    icon: BookOpen,
    title: "Selalu Belajar",
    description: "Glosarium dan penjelasan CVSS dirancang agar pemula pun bisa memahami dasar-dasar kerentanan siber.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Breadcrumb items={[{ label: "Tentang" }]} />

      <div className="page-intro">
        <p className="eyebrow mb-3 text-[10px]">Mengenal InfoCVE</p>
        <h1 className="content-heading font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Tentang InfoCVE</h1>
      <p className="mt-4 text-base leading-8 text-muted-foreground">
        InfoCVE adalah proyek edukasi yang bertujuan membantu pelajar, developer, dan siapa pun di Indonesia memahami
        kerentanan keamanan siber (CVE) dengan lebih mudah. Alih-alih hanya menyalin data teknis mentah, setiap
        kerentanan dilengkapi penjelasan Bahasa Indonesia yang ramah pemula, di samping deskripsi aslinya.
      </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {values.map((value) => (
          <Card key={value.title} className="p-5 transition-[border-color,background-color] hover:border-accent/35 hover:bg-surface-hover/25 sm:p-6">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <value.icon className="size-4" />
            </span>
            <h3 className="mt-3 font-display text-sm font-medium text-foreground">{value.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{value.description}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Status Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            InfoCVE menampilkan data langsung dari{" "}
            <a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              NVD (National Vulnerability Database)
            </a>{" "}
            lewat REST API v2.0 resmi mereka — bukan data contoh, dan bukan hasil scraping. Beberapa hal tetap
            perlu diketahui: judul dan kategori setiap CVE disusun otomatis dari data NVD (NVD sendiri tidak
            menyediakan keduanya), penjelasan Bahasa Indonesia menyoroti istilah yang dikenali kamus kami alih-alih
            menerjemahkan penuh (sesuai prinsip tanpa terjemahan AI), dan statistik ringkas seperti jumlah
            vendor/kategori di beranda dihitung dari sampel CVE 120 hari terakhir, bukan seluruh sejarah NVD.
          </p>
          <p>
            InfoCVE <strong className="text-foreground">tidak berafiliasi</strong> dengan MITRE, NVD, atau CVE
            Program resmi manapun. Sesuai persyaratan penggunaan resmi NVD API:{" "}
            <em className="not-italic text-foreground">
              &ldquo;This product uses the NVD API but is not endorsed or certified by the NVD.&rdquo;
            </em>{" "}
            (Produk ini memakai NVD API, namun tidak didukung atau disertifikasi oleh NVD.) Untuk keputusan
            keamanan yang sesungguhnya, selalu rujuk sumber resmi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
