import { compareSemver, matchesNpmRange } from "./npm-semver";
import { createNpmPurl } from "./npm-purl";

export interface PackageJsonShape {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface PackageLockShape {
  name?: string;
  lockfileVersion?: number;
  packages?: Record<string, { name?: string; version?: string; link?: boolean; dependencies?: Record<string, string> }>;
  dependencies?: Record<string, NpmV1Dependency>;
}

interface NpmV1Dependency {
  version?: string;
  dependencies?: Record<string, NpmV1Dependency>;
}

export interface DependencyPackage {
  name: string;
  version: string;
  purl?: string;
  direct: boolean;
  transitive: boolean;
  locations: string[];
  declaredRanges: string[];
}

export interface InventoryWarning {
  code: string;
  message: string;
  packageName?: string;
}

export interface NpmInventory {
  packageName?: string;
  lockfileVersion: number;
  packages: DependencyPackage[];
  warnings: InventoryWarning[];
  complete: boolean;
}

const MAX_PACKAGES = 5_000;
const MAX_DEPTH = 100;

export function parseNpmLock(manifest: PackageJsonShape, lock: PackageLockShape): NpmInventory {
  const warnings: InventoryWarning[] = [];
  let complete = true;
  const version = Number(lock.lockfileVersion ?? 1);
  if (!Number.isInteger(version) || version < 1 || version > 3) {
    warnings.push({ code: "UNSUPPORTED_LOCKFILE_VERSION", message: `lockfileVersion ${String(lock.lockfileVersion)} tidak didukung.` });
    complete = false;
  }

  const declarations = new Map<string, string[]>();
  const declaredPackageNames = new Map<string, string[]>();
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const) {
    const entries = manifest[field] ?? {};
    for (const [name, range] of Object.entries(entries)) {
      if (!validPackageName(name) || typeof range !== "string" || !range.trim()) {
        warnings.push({ code: "INVALID_MANIFEST_DEPENDENCY", packageName: name, message: `Deklarasi dependency ${name} tidak valid.` });
        complete = false;
        continue;
      }
      const parsedSpec = parseNpmDependencySpec(name, range);
      if (!parsedSpec) {
        warnings.push({ code: "INVALID_MANIFEST_DEPENDENCY", packageName: name, message: `Spesifikasi dependency ${name} tidak valid atau tidak didukung.` });
        complete = false;
        continue;
      }
      const ranges = declarations.get(name) ?? [];
      if (!ranges.includes(parsedSpec.range)) ranges.push(parsedSpec.range);
      declarations.set(name, ranges);
      const packageNames = declaredPackageNames.get(name) ?? [];
      if (!packageNames.includes(parsedSpec.packageName)) packageNames.push(parsedSpec.packageName);
      declaredPackageNames.set(name, packageNames);
    }
  }
  for (const [name, ranges] of declarations) {
    if (ranges.length > 1 || (declaredPackageNames.get(name)?.length ?? 0) > 1) {
      warnings.push({ code: "MANIFEST_RANGE_CONFLICT", packageName: name, message: `${name} dideklarasikan dengan rentang versi berbeda.` });
      complete = false;
    }
  }

  const records = new Map<string, DependencyPackage>();
  const addPackage = (name: string, packageVersion: string | undefined, location: string, direct: boolean, installName = name) => {
    if (records.size >= MAX_PACKAGES) {
      if (!warnings.some((warning) => warning.code === "PACKAGE_LIMIT_REACHED")) {
        warnings.push({ code: "PACKAGE_LIMIT_REACHED", message: `Pemindaian dibatasi pada ${MAX_PACKAGES} dependency.` });
      }
      complete = false;
      return;
    }
    if (!validPackageName(name)) {
      warnings.push({ code: "INVALID_LOCKED_PACKAGE_NAME", packageName: name, message: "Nama dependency dalam lockfile tidak valid." });
      complete = false;
      return;
    }
    if (typeof packageVersion !== "string" || !packageVersion.trim()) {
      warnings.push({ code: "MISSING_LOCKED_VERSION", packageName: name, message: `${name} tidak memiliki versi pasti di lockfile.`, });
      complete = false;
      return;
    }
    if (packageVersion.length > 128 || compareSemver(packageVersion, packageVersion) === null) {
      warnings.push({ code: "UNSUPPORTED_LOCKED_VERSION", packageName: name, message: `Versi ${name}@${packageVersion.slice(0, 64)} bukan versi SemVer pasti yang dapat dicocokkan.` });
      complete = false;
      return;
    }
    const key = `${name}\0${packageVersion}`;
    const record = records.get(key) ?? {
      name,
      version: packageVersion,
      purl: createNpmPurl(name),
      direct: false,
      transitive: false,
      locations: [],
      declaredRanges: declarations.get(installName) ?? [],
    };
    if (!record.locations.includes(location)) record.locations.push(location);
    record.direct ||= direct;
    record.transitive ||= !direct;
    records.set(key, record);
  };

  if (lock.packages && version >= 2) {
    for (const [packagePath, record] of Object.entries(lock.packages)) {
      if (!packagePath || !packagePath.includes("node_modules/")) continue;
      if (!isSafeLockPackagePath(packagePath)) {
        warnings.push({ code: "INVALID_LOCKED_PACKAGE_PATH", packageName: record?.name, message: "Ada lokasi dependency dalam lockfile yang mengandung segmen path tidak aman." });
        complete = false;
        continue;
      }
      if (record.link) {
        warnings.push({ code: "LINKED_DEPENDENCY_UNSUPPORTED", packageName: record.name, message: `Dependency lokal/link ${record.name ?? packagePath} tidak memiliki versi registry yang dapat dipindai.` });
        complete = false;
        continue;
      }
      const installName = packageNameFromPath(packagePath);
      const name = record.name || installName;
      if (!name || !installName) {
        warnings.push({ code: "INVALID_LOCKED_PACKAGE_PATH", message: "Ada lokasi dependency yang tidak dapat dikenali." });
        complete = false;
        continue;
      }
      const direct = packagePath === `node_modules/${installName}` && declarations.has(installName);
      if (direct && !declaredPackageNames.get(installName)?.includes(name)) {
        warnings.push({ code: "LOCK_ALIAS_IDENTITY_CONFLICT", packageName: installName, message: `package.json meminta ${installName}, tetapi lockfile mengidentifikasi ${name}.` });
        complete = false;
      }
      addPackage(name, record.version, packagePath, direct, installName);
    }
  } else if (lock.dependencies) {
    const visit = (dependencies: Record<string, NpmV1Dependency>, parentPath: string, depth: number) => {
      if (depth > MAX_DEPTH) {
        warnings.push({ code: "DEPENDENCY_DEPTH_LIMIT", message: `Pohon dependency melebihi kedalaman ${MAX_DEPTH}.` });
        complete = false;
        return;
      }
      for (const [name, record] of Object.entries(dependencies)) {
        const location = `${parentPath}/node_modules/${name}`.replace(/^\//, "");
        addPackage(name, record.version, location, depth === 0 && declarations.has(name), name);
        if (record.dependencies) visit(record.dependencies, location, depth + 1);
      }
    };
    visit(lock.dependencies, "", 0);
  } else if (declarations.size > 0) {
    warnings.push({ code: "LOCKFILE_DEPENDENCIES_MISSING", message: "Lockfile tidak memuat daftar package yang dapat dianalisis." });
    complete = false;
  }

  for (const [name, ranges] of declarations) {
    const directInstances = Array.from(records.values()).filter((item) => item.locations.includes(`node_modules/${name}`));
    if (directInstances.length === 0) {
      warnings.push({ code: "MISSING_LOCKED_DEPENDENCY", packageName: name, message: `${name} tercantum di package.json tetapi tidak ditemukan sebagai dependency langsung di lockfile.` });
      complete = false;
      continue;
    }
    for (const item of directInstances) {
      if (!declaredPackageNames.get(name)?.includes(item.name)) continue;
      for (const declaredRange of ranges) {
        const matches = matchesNpmRange(item.version, declaredRange);
        if (matches === false) {
          warnings.push({ code: "LOCK_VERSION_CONFLICT", packageName: name, message: `${name}@${item.version} tidak memenuhi rentang ${declaredRange} di package.json.` });
          complete = false;
        } else if (matches === null) {
          warnings.push({ code: "MANIFEST_RANGE_UNSUPPORTED", packageName: name, message: `Rentang ${declaredRange} untuk ${name} tidak dapat diverifikasi otomatis.` });
          complete = false;
        }
      }
    }
  }

  const versionsByName = new Map<string, Set<string>>();
  for (const item of records.values()) {
    const versions = versionsByName.get(item.name) ?? new Set<string>();
    versions.add(item.version);
    versionsByName.set(item.name, versions);
  }
  for (const [name, versions] of versionsByName) {
    if (versions.size > 1) {
      warnings.push({ code: "MULTIPLE_INSTALLED_VERSIONS", packageName: name, message: `${name} terpasang dalam beberapa versi: ${Array.from(versions).join(", ")}. Masing-masing versi dipindai terpisah.` });
    }
  }

  const packages = Array.from(records.values()).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return {
    packageName: manifest.name ?? lock.name,
    lockfileVersion: version,
    packages,
    warnings,
    complete,
  };
}

function packageNameFromPath(packagePath: string): string | null {
  const parts = packagePath.split("/");
  let start = -1;
  for (let i = 0; i < parts.length; i += 1) if (parts[i] === "node_modules") start = i;
  const packageSegment = parts[start + 1];
  if (start < 0 || !packageSegment) return null;
  if (packageSegment.startsWith("@")) {
    const scopedName = parts[start + 2];
    return scopedName ? `${packageSegment}/${scopedName}` : null;
  }
  return packageSegment;
}

function isSafeLockPackagePath(packagePath: string): boolean {
  const segments = packagePath.split("/");
  return !packagePath.includes("\\") && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function validPackageName(name: string): boolean {
  if (name.length === 0 || name.length > 214 || name.startsWith(".") || name.startsWith("_")) return false;
  return /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(name);
}

export function parseNpmDependencySpec(installName: string, spec: string): { packageName: string; range: string } | null {
  if (!spec.startsWith("npm:")) return { packageName: installName, range: spec };
  const alias = spec.slice(4);
  const scopeEnd = alias.startsWith("@") ? alias.indexOf("/") : -1;
  const versionStart = alias.indexOf("@", scopeEnd >= 0 ? scopeEnd + 1 : 0);
  const packageName = versionStart < 0 ? alias : alias.slice(0, versionStart);
  const range = versionStart < 0 ? "*" : alias.slice(versionStart + 1);
  if (!validPackageName(packageName) || (versionStart >= 0 && !range.trim())) return null;
  return { packageName, range };
}
