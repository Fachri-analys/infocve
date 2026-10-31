import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const lock = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"));
const root = lock.packages?.[""] ?? {};
const directRuntime = new Set(Object.keys(root.dependencies ?? {}));
const directDevelopment = new Set(Object.keys(root.devDependencies ?? {}));
const directOptional = new Set(Object.keys(root.optionalDependencies ?? {}));
const packageEntries = Object.entries(lock.packages ?? {})
  .filter(([key]) => key.startsWith("node_modules/"))
  .sort(([left], [right]) => left.localeCompare(right));

const rows = [];
const notices = [];
const reviewCounts = { needsReview: 0, missingRepository: 0, missingAuthor: 0, missingCopyright: 0, missingLicense: 0, missingNoticeFile: 0 };
for (const [lockPath, lockedPackage] of packageEntries) {
  const packageName = lockPath.slice(lockPath.lastIndexOf("node_modules/") + "node_modules/".length);
  const installedPath = path.join(rootDir, lockPath);
  const packageJsonPath = path.join(installedPath, "package.json");
  let installedPackage = {};
  try {
    installedPackage = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch {
    // Optional packages for other platforms may not be installed locally.
  }

  const name = installedPackage.name ?? lockedPackage.name ?? packageName;
  const version = lockedPackage.version ?? installedPackage.version ?? "version tidak tersedia";
  const declaredAuthor = formatPerson(installedPackage.author ?? lockedPackage.author);
  const repository = formatRepository(installedPackage.repository ?? lockedPackage.repository);
  const licenseMetadata = installedPackage.license ?? lockedPackage.license;
  const license = formatLicense(licenseMetadata);
  const packagePage = `https://www.npmjs.com/package/${encodeURIComponent(name)}`;
  const isDirectRuntime = lockPath === `node_modules/${packageName}` && directRuntime.has(packageName);
  const isDirectDevelopment = lockPath === `node_modules/${packageName}` && directDevelopment.has(packageName);
  const isDirectOptional = lockPath === `node_modules/${packageName}` && directOptional.has(packageName);
  const dependencyType = isDirectRuntime ? "Langsung · runtime"
    : isDirectDevelopment ? "Langsung · development"
      : isDirectOptional ? "Langsung · optional"
        : lockedPackage.dev ? "Transitif · development"
          : lockedPackage.optional ? "Transitif · optional"
            : "Transitif · runtime";

  const noticeFiles = readNoticeFiles(installedPath);
  const copyrightNotices = Array.from(new Set(noticeFiles.flatMap(({ content }) => extractCopyrightNotices(content))));
  const reviewReasons = [];
  if (!declaredAuthor) { reviewReasons.push("author yang dinyatakan upstream tidak tercantum"); reviewCounts.missingAuthor += 1; }
  if (copyrightNotices.length === 0) { reviewReasons.push("notice copyright/pemegang hak tidak ditemukan"); reviewCounts.missingCopyright += 1; }
  if (!repository) { reviewReasons.push("repository resmi tidak tercantum"); reviewCounts.missingRepository += 1; }
  if (!licenseMetadata || license === "UNLICENSED" || license.startsWith("Lisensi dideklarasikan dalam format tidak dikenal")) { reviewReasons.push("deklarasi lisensi perlu ditinjau"); reviewCounts.missingLicense += 1; }
  if (noticeFiles.length === 0) { reviewReasons.push("file LICENSE/NOTICE tidak ditemukan di instalasi lokal"); reviewCounts.missingNoticeFile += 1; }
  if (reviewReasons.length) reviewCounts.needsReview += 1;
  const reviewLabel = reviewReasons.length ? `Needs Review: ${reviewReasons.join("; ")}` : "Metadata tersedia; cocokkan dengan distribusi upstream";

  rows.push(`| ${escapeCell(name)} | ${escapeCell(version)} | ${escapeCell(dependencyType)} | ${repository ? `[repository](${escapeUrl(repository)})` : "**Needs Review** · tidak dinyatakan"} | ${declaredAuthor ? escapeCell(declaredAuthor) : "**Needs Review** · tidak dinyatakan"} | ${copyrightNotices.length ? escapeCell(copyrightNotices.join("; ")) : "**Needs Review** · tidak ditemukan"} | ${escapeCell(license)} | ${noticeFiles.length ? `${noticeFiles.length} file disertakan di bawah` : "**Needs Review** · notice tidak ada di instalasi"} | ${escapeCell(reviewLabel)} | [npm metadata](${packagePage}) |`);

  if (noticeFiles.length > 0) {
    notices.push(`### ${name}@${version}\n\nFile notice berikut disalin tanpa perubahan dari paket terpasang.\n\n${noticeFiles.map(({ fileName, content }) => {
      const escapedContent = escapeHtml(content.replace(/\r\n/g, "\n"));
      return `<details>\n<summary>${escapeHtml(fileName)}</summary>\n\n<pre>\n${escapedContent}\n</pre>\n</details>`;
    }).join("\n\n")}\n`);
  }
}

const output = [
  "# Third-party notices",
  "",
  "Inventaris ini dibuat dari `package-lock.json` (lockfile v" + lock.lockfileVersion + ") dan metadata paket yang tersedia di `node_modules`. Versi pada kolom adalah versi terkunci yang tepat. Jalankan `node scripts/generate-third-party-notices.mjs` setelah mengubah lockfile atau memasang ulang dependency untuk memperbaruinya.",
  "",
  "Kolom author menyalin deklarasi author/contributor dari metadata paket. Kolom copyright menyalin baris copyright dari file LICENSE/NOTICE jika tersedia; keduanya adalah pernyataan upstream, bukan verifikasi independen bahwa orang/organisasi tersebut memegang seluruh hak. Repository, lisensi, atau pemberitahuan pemegang hak yang tidak ditemukan ditandai **Needs Review**. Halaman npm hanya link metadata/artifact, bukan pengganti repository resmi. Paket platform yang tidak terpasang lokal memerlukan pemeriksaan upstream untuk file notice lengkap.",
  "",
  `Paket terkunci tercatat: **${packageEntries.length}**. Semua paket dihitung, termasuk dependency transitif, development, optional, dan paket spesifik platform. InfoCVE tidak mengubah lisensi atau copyright komponen ini.`,
  `Cakupan metadata saat dibuat: **${notices.length}** paket memiliki file LICENSE/NOTICE lokal; **${packageEntries.length - reviewCounts.missingCopyright}** memiliki baris copyright yang terdeteksi; **${reviewCounts.needsReview}** paket ditandai **Needs Review** (repository tidak tercantum: ${reviewCounts.missingRepository}; author tidak tercantum: ${reviewCounts.missingAuthor}; notice copyright tidak ditemukan: ${reviewCounts.missingCopyright}; file LICENSE/NOTICE lokal tidak ditemukan: ${reviewCounts.missingNoticeFile}; lisensi tidak dinyatakan/perlu ditinjau: ${reviewCounts.missingLicense}). Kolom author bukan bukti pemilik hak.`,
  "",
  "## Inventaris dependency",
  "",
  "| Paket | Versi terkunci | Jenis | Repository resmi | Author yang dinyatakan | Copyright notice yang ditemukan | Lisensi metadata | Notice lokal | Status pemeriksaan | Metadata package |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows,
  "",
  "## Salinan file LICENSE / NOTICE yang tersedia",
  "",
  "Teks berikut berasal dari file notice dalam paket pada `node_modules`. Pertahankan notice yang relevan ketika mendistribusikan binary, bundle, atau source yang mengandung komponen tersebut. Daftar ini hanya salinan file yang tersedia pada mesin saat dibuat; paket tanpa file lokal ditandai pada inventaris dan bukan berarti bebas dari kewajiban atribusi.",
  "",
  ...notices,
  "## Pemeriksaan manual sebelum distribusi",
  "",
  "1. Tinjau seluruh baris **Needs Review**, termasuk package tanpa author, repository, copyright notice, deklarasi lisensi, atau file notice lokal.",
  "2. Periksa syarat lisensi untuk artifact yang benar-benar dikirim pada target deployment; dependency opsional/platform dapat berbeda antar-OS.",
  "3. Pertahankan pemberitahuan copyright, teks LICENSE/NOTICE, atribusi, dan lisensi transitive sesuai ketentuan pemiliknya.",
  "4. Inventaris ini bukan kesimpulan hukum dan tidak memverifikasi apakah semua deklarasi upstream lengkap atau akurat.",
  "",
].join("\n");

fs.writeFileSync(path.join(rootDir, "THIRD_PARTY_NOTICES.md"), output, "utf8");
console.log(`Wrote THIRD_PARTY_NOTICES.md for ${packageEntries.length} locked packages (${notices.length} packages with local license/notice files).`);

function formatPerson(value) {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object" && typeof value.name === "string") return value.name.trim() || null;
  return null;
}

function formatRepository(value) {
  let url = typeof value === "string" ? value : value && typeof value === "object" && typeof value.url === "string" ? value.url : null;
  if (!url) return null;
  url = url.replace(/^git\+/, "").replace(/\.git$/, "");
  if (url.startsWith("github:")) return `https://github.com/${url.slice("github:".length)}`;
  if (/^[^/:]+\/[^/:]+$/.test(url)) return `https://github.com/${url}`;
  if (url.startsWith("git://github.com/")) return url.replace("git://", "https://");
  if (url.startsWith("ssh://git@github.com/")) return url.replace("ssh://git@", "https://");
  if (url.startsWith("git@github.com:")) return `https://github.com/${url.slice("git@github.com:".length)}`;
  return url;
}

function formatLicense(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.type === "string") return value.type;
  return value ? "Lisensi dideklarasikan dalam format tidak dikenal" : "**Needs Review** · tidak dinyatakan";
}

function extractCopyrightNotices(content) {
  return content.split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => /^(?:copyright\b|©|\(c\)\s*(?:©\s*)?\d{4})/i.test(line))
    .map((line) => line.slice(0, 240));
}

function readNoticeFiles(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^(license|licence|copying|notice|patents)([-_.].*)?$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({ fileName: entry.name, content: fs.readFileSync(path.join(directory, entry.name), "utf8") }));
  } catch {
    return [];
  }
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeUrl(value) {
  return encodeURI(value).replace(/\)/g, "%29");
}

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
