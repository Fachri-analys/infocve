interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<number | string>;
}

interface PartialVersion {
  major?: number;
  minor?: number;
  patch?: number;
  specified: number;
  wildcard: boolean;
  prerelease: string;
}

export function compareSemver(left: string, right: string): number | null {
  if (left === "0") return right === "0" ? 0 : -1;
  if (right === "0") return 1;
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const ap = a.prerelease[index];
    const bp = b.prerelease[index];
    if (ap === undefined) return -1;
    if (bp === undefined) return 1;
    if (ap === bp) continue;
    if (typeof ap === "number" && typeof bp === "number") return ap < bp ? -1 : 1;
    if (typeof ap === "number") return -1;
    if (typeof bp === "number") return 1;
    return ap < bp ? -1 : 1;
  }
  return 0;
}

/** Returns null for npm range syntaxes this small evaluator cannot prove. */
export function matchesNpmRange(version: string, range: string): boolean | null {
  const actual = parseSemver(version);
  if (!actual || /(?:^|\s)(?:git\+|https?:|file:|workspace:|npm:)/i.test(range)) return null;
  const normalizedRange = range.trim();
  if (!normalizedRange) return actual.prerelease.length === 0;
  if ((normalizedRange === "*" || /^x$/i.test(normalizedRange)) && actual.prerelease.length > 0) return false;
  const alternatives = normalizedRange.split("||");
  let unsupported = false;
  for (const alternative of alternatives) {
    const result = matchesComparatorSet(version, alternative.trim());
    if (result === true) return true;
    if (result === null) unsupported = true;
  }
  return unsupported ? null : false;
}

export interface OsvRangeEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
  limit?: string;
}

export interface OsvRange {
  type: string;
  events: OsvRangeEvent[];
}

/** Applies the OSV range-event rules for npm's semantic version ordering. */
export function isOsvVersionAffected(
  version: string,
  ranges: OsvRange[],
  exactVersions: string[] = []
): boolean | null {
  if (!parseSemver(version)) return null;
  if (exactVersions.some((entry) => normalizeVersion(entry) === normalizeVersion(version))) return true;
  if (ranges.length === 0) return exactVersions.length > 0 ? false : null;

  let unsupported = false;
  for (const range of ranges) {
    // This matcher is used only for npm inventory. OSV ECOSYSTEM events are
    // compared using the package ecosystem's version model; npm's is SemVer.
    if ((range.type !== "SEMVER" && range.type !== "ECOSYSTEM") || !Array.isArray(range.events) || !isWellFormedOsvEvents(range.events)) {
      unsupported = true;
      continue;
    }
    const hasLimit = range.events.some((event) => event.limit !== undefined);
    const withinLimit = !hasLimit || range.events.some((event) => {
      if (!event.limit) return false;
      if (event.limit === "*") return true;
      const compared = compareSemver(version, event.limit);
      if (compared === null) {
        unsupported = true;
        return false;
      }
      return compared < 0;
    });
    if (!withinLimit) continue;

    let affected = false;
    for (const event of range.events) {
      if (event.introduced !== undefined) {
        const compared = compareSemver(version, event.introduced);
        if (compared === null) {
          unsupported = true;
          break;
        }
        if (compared >= 0) affected = true;
      } else if (event.fixed !== undefined) {
        const compared = compareSemver(version, event.fixed);
        if (compared === null) {
          unsupported = true;
          break;
        }
        if (compared >= 0) affected = false;
      } else if (event.last_affected !== undefined) {
        const compared = compareSemver(version, event.last_affected);
        if (compared === null) {
          unsupported = true;
          break;
        }
        if (compared > 0) affected = false;
      }
    }
    if (affected) return true;
  }
  return unsupported ? null : false;
}

function matchesComparatorSet(version: string, range: string): boolean | null {
  if (!range || range === "*" || /^x$/i.test(range)) return true;
  const hyphen = range.match(/^(.+?)\s+-\s+(.+)$/);
  if (hyphen) {
    const lower = expandPartial(hyphen[1]!.trim());
    const upper = expandPartial(hyphen[2]!.trim());
    if (!lower || !upper) return null;
    const lowCheck = compareSemver(version, lower.floor);
    const highCheck = compareSemver(version, upper.ceil ?? upper.floor);
    if (lowCheck === null || highCheck === null) return null;
    const inRange = lowCheck >= 0 && (upper.ceil ? highCheck < 0 : highCheck <= 0);
    return inRange && prereleaseAllowed(version, [hyphen[1]!.trim(), hyphen[2]!.trim()]);
  }

  const tokens = range.replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1").replace(/,/g, " ").split(/\s+/).filter(Boolean);
  let allTrue = true;
  const prereleaseBases: string[] = [];
  for (const token of tokens) {
    const match = token.match(/^(\^|~|>=|<=|>|<|=)?\s*(.+)$/);
    if (!match) return null;
    const operator = match[1] ?? "";
    const versionPart = match[2]!.trim();
    const versionWithoutBuild = versionPart.split("+", 1)[0]!;
    if (versionWithoutBuild.includes("-")) prereleaseBases.push(versionWithoutBuild);
    const check = comparatorMatches(version, operator, versionPart);
    if (check === null) return null;
    if (!check) allTrue = false;
  }
  const actual = parseSemver(version);
  if (!actual) return null;
  return allTrue && prereleaseAllowed(version, prereleaseBases);
}

function prereleaseAllowed(version: string, comparatorVersions: string[]): boolean {
  const actual = parseSemver(version);
  if (!actual || actual.prerelease.length === 0) return true;
  return comparatorVersions.some((candidate) => {
    const normalized = candidate.split("+", 1)[0]!;
    if (!normalized.includes("-")) return false;
    const parsed = parseSemver(normalized);
    return parsed?.major === actual.major && parsed.minor === actual.minor && parsed.patch === actual.patch;
  });
}

function comparatorMatches(version: string, operator: string, value: string): boolean | null {
  const partial = parsePartial(value);
  if (!partial) return null;
  if (partial.wildcard && !operator) return isWithinPartial(version, partial);
  if (partial.wildcard && (operator === "^" || operator === "~")) {
    const bounds = expandCaretOrTilde(partial, operator);
    if (!bounds) return null;
    return atLeast(version, bounds.floor) && lessThan(version, bounds.ceil);
  }
  if (partial.wildcard && operator) {
    const bounds = expandPartial(value);
    if (!bounds) return null;
    const lower = bounds.floor;
    const upper = bounds.ceil;
    if (operator === ">=") return atLeast(version, lower);
    if (operator === ">") return upper ? atLeast(version, upper) : greaterThan(version, lower);
    if (operator === "<") return lessThan(version, lower);
    if (operator === "<=") return upper ? lessThan(version, upper) : atMost(version, lower);
    if (operator === "=") return isWithinPartial(version, partial);
    return null;
  }

  const prerelease = value.split("+", 1)[0]!.match(/-[0-9A-Za-z.-]+/)?.[0] ?? "";
  const bound = `${partial.major}.${partial.minor}.${partial.patch}${prerelease}`;
  if (operator === "^") {
    const bounds = expandCaretOrTilde(partial, "^");
    return bounds ? atLeast(version, bounds.floor) && lessThan(version, bounds.ceil) : null;
  }
  if (operator === "~") {
    const bounds = expandCaretOrTilde(partial, "~");
    return bounds ? atLeast(version, bounds.floor) && lessThan(version, bounds.ceil) : null;
  }
  const compared = compareSemver(version, bound);
  if (compared === null) return null;
  if (operator === ">") return compared > 0;
  if (operator === ">=") return compared >= 0;
  if (operator === "<") return compared < 0;
  if (operator === "<=") return compared <= 0;
  return compared === 0;
}

function parseSemver(value: string): Semver | null {
  const normalized = normalizeVersion(value);
  const match = normalized.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
  if (!match) return null;
  const core = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (core.some((part) => !Number.isSafeInteger(part))) return null;
  const prerelease = match[4]
    ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
  if (match[4]?.split(".").some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))) return null;
  if (prerelease.some((part) => typeof part === "number" && !Number.isSafeInteger(part))) return null;
  return { major: core[0]!, minor: core[1]!, patch: core[2]!, prerelease };
}

function parsePartial(value: string): PartialVersion | null {
  const normalized = normalizeVersion(value);
  const metadataParts = normalized.split("+");
  if (metadataParts.length > 2 || (metadataParts.length === 2 && !/^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/.test(metadataParts[1]!))) return null;
  const withoutMetadata = metadataParts[0]!;
  const prerelease = withoutMetadata.match(/-([0-9A-Za-z.-]+)$/)?.[0] ?? "";
  const core = prerelease ? withoutMetadata.slice(0, -prerelease.length) : withoutMetadata;
  const parts = core.split(".");
  if (parts.length > 3 || parts.length === 0) return null;
  const values: Array<number | undefined> = [];
  let wildcard = false;
  for (const part of parts) {
    if (/^(?:x|\*)$/i.test(part)) {
      wildcard = true;
      values.push(undefined);
    } else if (/^(0|[1-9]\d*)$/.test(part) && !wildcard) {
      values.push(Number(part));
    } else {
      return null;
    }
  }
  if (prerelease && (parts.length !== 3 || parseSemver(`${core}${prerelease}`) === null)) return null;
  if (parts.some((part) => /^\d+$/.test(part) && !Number.isSafeInteger(Number(part)))) return null;
  return { major: values[0], minor: values[1], patch: values[2], specified: parts.length, wildcard: wildcard || parts.length < 3, prerelease };
}

function expandPartial(value: string): { floor: string; ceil?: string } | null {
  const part = parsePartial(value);
  if (!part) return null;
  const major = part.major ?? 0;
  const minor = part.minor ?? 0;
  const patch = part.patch ?? 0;
  const floor = `${major}.${minor}.${patch}${part.prerelease}`;
  if (!part.wildcard) return { floor };
  if (part.specified <= 1 || part.minor === undefined) return { floor, ceil: `${major + 1}.0.0` };
  return { floor, ceil: `${major}.${minor + 1}.0` };
}

function expandCaretOrTilde(part: PartialVersion, operator: string): { floor: string; ceil: string } | null {
  const floor = `${part.major ?? 0}.${part.minor ?? 0}.${part.patch ?? 0}${part.prerelease}`;
  const major = part.major ?? 0;
  const minor = part.minor ?? 0;
  const patch = part.patch ?? 0;
  let ceil: string;
  if (operator === "~") {
    ceil = part.specified <= 1 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;
  } else if (major > 0 || part.specified <= 1) {
    ceil = `${major + 1}.0.0`;
  } else if (minor > 0 || part.specified <= 2) {
    ceil = `0.${minor + 1}.0`;
  } else {
    ceil = `0.0.${patch + 1}`;
  }
  return { floor, ceil };
}

function isWithinPartial(version: string, partial: PartialVersion): boolean {
  const actual = parseSemver(version);
  if (!actual) return false;
  if (partial.major !== undefined && actual.major !== partial.major) return false;
  if (partial.minor !== undefined && actual.minor !== partial.minor) return false;
  if (partial.patch !== undefined && actual.patch !== partial.patch) return false;
  return true;
}

function atLeast(version: string, bound: string): boolean {
  return (compareSemver(version, bound) ?? -1) >= 0;
}
function greaterThan(version: string, bound: string): boolean {
  return (compareSemver(version, bound) ?? -1) > 0;
}
function atMost(version: string, bound: string): boolean {
  return (compareSemver(version, bound) ?? 1) <= 0;
}
function lessThan(version: string, bound: string): boolean {
  return (compareSemver(version, bound) ?? 1) < 0;
}
function normalizeVersion(value: string): string {
  return value.trim().replace(/^[v=](?=\d)/i, "");
}

function isWellFormedOsvEvents(events: OsvRangeEvent[]): boolean {
  if (events.length === 0 || !events.some((event) => event.introduced !== undefined)) return false;
  let previous: string | undefined;
  let hasFixed = false;
  let hasLastAffected = false;

  for (const event of events) {
    const values = [event.introduced, event.fixed, event.last_affected, event.limit].filter((value) => value !== undefined);
    if (values.length !== 1) return false;
    if (event.introduced === "0") continue;
    const version = values[0];
    if (!version) return false;
    if (event.limit === "*") continue;
    if (compareSemver(version, version) === null) return false;
    if (event.fixed !== undefined) hasFixed = true;
    if (event.last_affected !== undefined) hasLastAffected = true;
    if (previous !== undefined) {
      const order = compareSemver(previous, version);
      if (order === null || order >= 0) return false;
    }
    previous = version;
  }
  return !(hasFixed && hasLastAffected);
}
