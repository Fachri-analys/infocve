import { compareSemver } from "./npm-semver";

export interface ParsedNpmPurl {
  name: string;
  version?: string;
}

/** Builds the canonical PURL path for an npm package, including a version only when supplied. */
export function createNpmPurl(name: string, version?: string): string {
  const [namespace, packageName] = name.startsWith("@") ? name.slice(1).split("/") : [undefined, name];
  const path = namespace
    ? `%40${encodeURIComponent(namespace)}/${encodeURIComponent(packageName ?? "")}`
    : encodeURIComponent(packageName ?? "");
  return `pkg:npm/${path}${version ? `@${encodeURIComponent(version)}` : ""}`;
}

/** Parses only npm PURLs; unsupported types or malformed paths are never normalized to a package name. */
export function parseNpmPurl(value: string): ParsedNpmPurl | null {
  if (value.length > 512 || !value.startsWith("pkg:npm/")) return null;
  const withoutFragment = value.split("#", 1)[0]!;
  const pathAndVersion = withoutFragment.slice("pkg:npm/".length).split("?", 1)[0]!;
  const parts = pathAndVersion.split("/");
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => !part)) return null;

  let namespace: string | undefined;
  let namePart = parts.at(-1)!;
  if (parts.length === 2) {
    if (!parts[0]!.toLowerCase().startsWith("%40")) return null;
    try { namespace = decodeURIComponent(parts[0]!); } catch { return null; }
    if (!namespace.startsWith("@") || namespace.length < 2 || namespace.includes("/")) return null;
  }

  const versionSeparator = namePart.lastIndexOf("@");
  let version: string | undefined;
  if (versionSeparator >= 0) {
    const decodedVersion = decodePart(namePart.slice(versionSeparator + 1));
    if (!decodedVersion) return null;
    version = decodedVersion;
    namePart = namePart.slice(0, versionSeparator);
  }
  const packageName = decodePart(namePart);
  if (!packageName || packageName.includes("/")) return null;
  const name = namespace ? `${namespace}/${packageName}` : packageName;
  if (!isValidNpmName(name)) return null;
  return { name, ...(version ? { version } : {}) };
}

export function npmPurlMatches(purl: string, name: string, version: string): boolean | null {
  const parsed = parseNpmPurl(purl);
  if (!parsed) return false;
  if (parsed.name !== name) return false;
  if (parsed.version === undefined) return true;
  const comparison = compareSemver(parsed.version, version);
  return comparison === null ? false : comparison === 0;
}

function decodePart(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isValidNpmName(name: string): boolean {
  return /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(name);
}
