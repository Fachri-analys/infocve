import type { PackageJsonShape, PackageLockShape } from "./npm-manifest";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_LOCK_RECORDS = 20_000;
const MAX_LOCK_DEPTH = 100;

export class ScanUploadError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) {
    super(message);
    this.name = "ScanUploadError";
  }
}

export async function readNpmScanUpload(request: Request): Promise<{ manifest: PackageJsonShape; lock: PackageLockShape }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;") || !contentType.includes("boundary=")) {
    throw new ScanUploadError("Unggah harus menggunakan multipart/form-data.");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    throw new ScanUploadError("Ukuran total unggahan melebihi 2 MB.", 413);
  }

  const bytes = await readBoundedBody(request, contentType);
  let form: FormData;
  try {
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    form = await new Response(body.buffer, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    throw new ScanUploadError("Format multipart unggahan tidak valid.");
  }
  const manifestFile = getSingleFile(form, "packageJson");
  const lockFile = getSingleFile(form, "packageLockJson");
  if (manifestFile.size > MAX_FILE_BYTES || lockFile.size > MAX_FILE_BYTES) {
    throw new ScanUploadError("Setiap file dibatasi hingga 1 MB.", 413);
  }
  const manifest = parseJsonFile(await manifestFile.arrayBuffer(), "package.json");
  const lock = parseJsonFile(await lockFile.arrayBuffer(), "package-lock.json");
  if (!isRecord(manifest) || !isRecord(lock)) throw new ScanUploadError("Kedua file harus berisi objek JSON.");
  validateManifest(manifest);
  validateLock(lock);
  return { manifest: manifest as PackageJsonShape, lock: lock as PackageLockShape };
}

async function readBoundedBody(request: Request, contentType: string): Promise<Buffer> {
  if (!request.body) throw new ScanUploadError("Isi unggahan tidak ditemukan.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new ScanUploadError("Ukuran total unggahan melebihi 2 MB.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ScanUploadError) throw error;
    throw new ScanUploadError("Unggahan tidak dapat dibaca.");
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  if (!contentType.includes("boundary=")) throw new ScanUploadError("Boundary multipart tidak ditemukan.");
  return bytes;
}

function getSingleFile(form: FormData, name: string): File {
  const values = form.getAll(name);
  if (values.length !== 1 || !values[0] || typeof values[0] === "string" || typeof values[0].arrayBuffer !== "function") {
    throw new ScanUploadError(`File ${name === "packageJson" ? "package.json" : "package-lock.json"} wajib diunggah satu kali.`);
  }
  if (values[0].size === 0) throw new ScanUploadError(`File ${values[0].name} kosong.`);
  if (values[0].size > MAX_FILE_BYTES) throw new ScanUploadError("Setiap file dibatasi hingga 1 MB.", 413);
  return values[0] as File;
}

function parseJsonFile(bytes: ArrayBuffer, name: string): unknown {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new ScanUploadError(`${name} bukan JSON UTF-8 yang valid.`);
  }
}

function validateManifest(manifest: Record<string, unknown>): void {
  if (manifest.name !== undefined && typeof manifest.name !== "string") throw new ScanUploadError("Field name di package.json harus berupa teks.");
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const value = manifest[field];
    if (value === undefined) continue;
    if (!isRecord(value) || Object.values(value).some((range) => typeof range !== "string")) {
      throw new ScanUploadError(`Field ${field} di package.json harus berupa pasangan nama dan rentang versi teks.`);
    }
  }
}

function validateLock(lock: Record<string, unknown>): void {
  if (lock.name !== undefined && typeof lock.name !== "string") throw new ScanUploadError("Field name di package-lock.json harus berupa teks.");
  if (lock.lockfileVersion !== undefined && typeof lock.lockfileVersion !== "number") throw new ScanUploadError("lockfileVersion harus berupa angka.");
  if (lock.packages !== undefined) {
    if (!isRecord(lock.packages)) throw new ScanUploadError("Field packages di package-lock.json harus berupa objek.");
    const entries = Object.entries(lock.packages);
    if (entries.length > MAX_LOCK_RECORDS) throw new ScanUploadError("Lockfile berisi terlalu banyak entri package.", 413);
    for (const [, item] of entries) {
      if (!isRecord(item)) throw new ScanUploadError("Lockfile memiliki entri package yang tidak valid.");
      if (["name", "version"].some((field) => item[field] !== undefined && typeof item[field] !== "string")) {
        throw new ScanUploadError("Nama atau versi package di lockfile tidak valid.");
      }
      if (item.link !== undefined && typeof item.link !== "boolean") throw new ScanUploadError("Penanda link di lockfile tidak valid.");
    }
  }
  if (lock.dependencies !== undefined) {
    if (!isRecord(lock.dependencies)) throw new ScanUploadError("Field dependencies di package-lock.json harus berupa objek.");
    let nodes = 0;
    const visit = (dependencies: Record<string, unknown>, depth: number) => {
      if (depth > MAX_LOCK_DEPTH) throw new ScanUploadError("Pohon dependency melewati batas kedalaman 100.", 413);
      for (const item of Object.values(dependencies)) {
        nodes += 1;
        if (nodes > MAX_LOCK_RECORDS) throw new ScanUploadError("Lockfile berisi terlalu banyak dependency.", 413);
        if (!isRecord(item)) throw new ScanUploadError("Dependency di lockfile tidak berbentuk objek.");
        if (item.version !== undefined && typeof item.version !== "string") throw new ScanUploadError("Versi dependency di lockfile tidak valid.");
        if (item.dependencies !== undefined) {
          if (!isRecord(item.dependencies)) throw new ScanUploadError("Pohon dependency di lockfile tidak valid.");
          visit(item.dependencies, depth + 1);
        }
      }
    };
    visit(lock.dependencies, 0);
  }
  if (lock.packages === undefined && lock.dependencies === undefined) {
    throw new ScanUploadError("Lockfile tidak memiliki packages atau dependencies.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
