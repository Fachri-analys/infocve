import type { Metadata } from "next";
import { DependencyScanner } from "@/components/scanner/dependency-scanner";

export const metadata: Metadata = {
  title: "Pemindai Dependency npm",
  description: "Pindai dependency npm terhadap advisori CVE, pahami mitigasi, verifikasi perbaikan, dan unduh laporan keamanan.",
};

export default function DependencyScannerPage() {
  return <DependencyScanner />;
}
