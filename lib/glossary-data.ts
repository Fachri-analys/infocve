import type { GlossaryTerm } from "@/types";

export const glossaryTerms: GlossaryTerm[] = [
  {
    slug: "cve",
    term: "CVE",
    abbreviation: "Common Vulnerabilities and Exposures",
    definitionId:
      "Daftar standar untuk kerentanan keamanan yang sudah diketahui publik. Setiap kerentanan mendapat ID unik dengan format CVE-TAHUN-NOMOR, misalnya CVE-2021-44228, agar semua orang — peneliti, vendor, pengguna — bisa membicarakan kerentanan yang sama tanpa salah paham.",
  },
  {
    slug: "cwe",
    term: "CWE",
    abbreviation: "Common Weakness Enumeration",
    definitionId:
      "Klasifikasi jenis kelemahan perangkat lunak berdasarkan akar penyebabnya, seperti \"validasi input yang kurang\" atau \"pembacaan di luar batas memori\". Bedanya dengan CVE: CWE menjelaskan jenis/kategori kelemahannya, sedangkan CVE adalah satu kejadian kerentanan yang spesifik.",
  },
  {
    slug: "cvss",
    term: "CVSS",
    abbreviation: "Common Vulnerability Scoring System",
    definitionId:
      "Sistem penilaian standar dari skala 0 sampai 10 untuk mengukur seberapa parah suatu kerentanan, berdasarkan faktor seperti seberapa mudah dieksploitasi dan seberapa besar dampaknya terhadap kerahasiaan, integritas, dan ketersediaan data.",
  },
  {
    slug: "rce",
    term: "RCE",
    abbreviation: "Remote Code Execution",
    definitionId:
      "Kondisi ketika penyerang bisa menjalankan kode atau perintah apa pun dari jarak jauh di perangkat korban, tanpa perlu akses fisik. Ini biasanya dianggap salah satu jenis kerentanan paling berbahaya karena bisa memberi kendali penuh atas sistem.",
  },
  {
    slug: "xss",
    term: "XSS",
    abbreviation: "Cross-Site Scripting",
    definitionId:
      "Penyerang menyisipkan skrip berbahaya (biasanya JavaScript) ke sebuah halaman web, yang kemudian ikut berjalan di browser pengguna lain yang membuka halaman tersebut — bisa dipakai untuk mencuri sesi login atau data pengguna.",
  },
  {
    slug: "sql-injection",
    term: "SQL Injection",
    definitionId:
      "Penyerang menyisipkan perintah SQL berbahaya lewat kolom input aplikasi (misalnya kolom login) untuk membaca, mengubah, atau menghapus data di basis data secara tidak sah.",
  },
  {
    slug: "ssrf",
    term: "SSRF",
    abbreviation: "Server-Side Request Forgery",
    definitionId:
      "Penyerang membuat server korban mengirim permintaan ke alamat yang seharusnya tidak bisa dijangkau dari luar, misalnya layanan internal perusahaan yang tidak terekspos ke internet.",
  },
  {
    slug: "csrf",
    term: "CSRF",
    abbreviation: "Cross-Site Request Forgery",
    definitionId:
      "Penyerang mengelabui pengguna yang sedang login di suatu situs agar, tanpa sadar, mengirim permintaan/aksi (misalnya mengganti email akun) lewat halaman lain yang dikendalikan penyerang.",
  },
  {
    slug: "lfi",
    term: "LFI",
    abbreviation: "Local File Inclusion",
    definitionId:
      "Aplikasi bisa dipaksa memuat isi berkas yang ada di server itu sendiri padahal seharusnya tidak boleh diakses, misalnya berkas konfigurasi yang berisi kredensial.",
  },
  {
    slug: "rfi",
    term: "RFI",
    abbreviation: "Remote File Inclusion",
    definitionId:
      "Mirip dengan LFI, tetapi berkas yang dimuat aplikasi berasal dari server atau lokasi lain di internet, bukan dari server itu sendiri — sering dipakai untuk menyisipkan kode berbahaya.",
  },
  {
    slug: "idor",
    term: "IDOR",
    abbreviation: "Insecure Direct Object Reference",
    definitionId:
      "Aplikasi tidak memeriksa dengan benar apakah pengguna berhak mengakses suatu data. Akibatnya, data milik orang lain bisa dilihat hanya dengan menebak atau mengubah ID pada URL, misalnya dari /invoice/101 menjadi /invoice/102.",
  },
  {
    slug: "broken-access-control",
    term: "Broken Access Control",
    definitionId:
      "Kegagalan sistem dalam membatasi apa yang boleh dilihat atau dilakukan oleh pengguna sesuai peran dan hak aksesnya, sehingga pengguna biasa bisa melakukan hal yang seharusnya hanya boleh dilakukan admin.",
  },
  {
    slug: "file-upload",
    term: "File Upload Vulnerability",
    definitionId:
      "Celah pada fitur unggah berkas yang membiarkan penyerang mengunggah berkas berbahaya (misalnya skrip) ke server, yang kemudian bisa dijalankan untuk mengambil alih sistem.",
  },
  {
    slug: "command-injection",
    term: "Command Injection",
    definitionId:
      "Penyerang menyisipkan perintah sistem operasi lewat input aplikasi, sehingga perintah tersebut ikut dijalankan oleh server — mirip SQL Injection, tetapi targetnya adalah sistem operasi, bukan basis data.",
  },
  {
    slug: "race-condition",
    term: "Race Condition",
    definitionId:
      "Celah yang muncul karena urutan atau waktu eksekusi beberapa proses tidak disinkronkan dengan benar, sehingga penyerang bisa memanfaatkan jeda waktu tersebut untuk memicu perilaku yang tidak seharusnya terjadi.",
  },
  {
    slug: "authentication",
    term: "Authentication",
    definitionId:
      'Proses memverifikasi identitas pengguna — memastikan "Anda benar-benar orang yang Anda klaim", biasanya lewat kata sandi, OTP, atau biometrik.',
  },
  {
    slug: "authorization",
    term: "Authorization",
    definitionId:
      "Proses menentukan apa yang boleh dilakukan atau dilihat oleh pengguna setelah identitasnya berhasil diverifikasi lewat autentikasi.",
  },
  {
    slug: "business-logic",
    term: "Business Logic Vulnerability",
    definitionId:
      "Celah yang muncul dari kesalahan pada alur atau aturan bisnis aplikasi itu sendiri (misalnya kupon diskon bisa dipakai berkali-kali), bukan dari bug teknis seperti buffer overflow.",
  },
  {
    slug: "directory-listing",
    term: "Directory Listing",
    definitionId:
      "Server secara tidak sengaja menampilkan daftar isi sebuah folder yang seharusnya tersembunyi, sehingga siapa pun bisa melihat nama-nama berkas di dalamnya.",
  },
  {
    slug: "path-traversal",
    term: "Path Traversal",
    definitionId:
      'Penyerang memanipulasi alamat/path berkas — sering memakai pola "../" — untuk mengakses berkas di luar folder yang seharusnya diizinkan oleh aplikasi.',
  },
];
