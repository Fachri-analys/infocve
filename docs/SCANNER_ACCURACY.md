# InfoCVE scanner accuracy and evidence

## Matching rules

- Inventory comes from the uploaded `package.json` and `package-lock.json`; package code and lifecycle scripts are never executed.
- A package match requires the exact npm ecosystem and exact package name. When a source provides a PURL, its npm type, package identity, and optional installed version must also match. Similar names are never treated as aliases.
- The installed version comes from the lockfile. npm SemVer comparison checks affected ranges, prerelease behavior, and fixed-version boundaries. OSV `SEMVER` and npm `ECOSYSTEM` ranges use this npm-specific comparator; unsupported range types stay unknown.
- Duplicated lockfile locations are retained, direct and transitive installs are recorded, and duplicate versions are evaluated separately. Alias package specs are resolved to the actual locked package identity.
- A vulnerability returned by a source is retained as a candidate when the detail record conflicts or cannot be evaluated. It is marked `Needs Review` or `Unverified`, and it is not counted as currently detected unless at least one exact-identity source says the installed version is affected. A non-comparable NVD/vendor record keeps the match in review even if OSV and GHSA agree.

## Sources and their limits

- OSV query and advisory detail provide the package identity and affected range used for the initial match. The source URL, retrieval time, source update time, range, evaluation, and reason are recorded.
- GitHub Security Advisories are fetched by GHSA IDs associated with the OSV candidate, with exact ecosystem/package/range checks. Transient network, rate limit, and server failures receive one bounded retry; failures make coverage incomplete.
- NVD is read from InfoCVE's local synchronized CVE snapshot. NVD CPE/product strings do not by themselves prove an npm package identity or PURL, so they are recorded as context and marked `Not Comparable` for npm matching. A same-looking product name is not enough to confirm or reject an npm package.
- Advisory URLs supplied by OSV or GHSA are retained as vendor reference provenance. InfoCVE does not fetch arbitrary vendor URLs or parse their pages into version ranges; those links are marked `Not Comparable` until an authoritative machine-readable vendor feed or reviewed parser is added.
- As a result, a report can contain an `Unverified` finding or `Completed with Warnings` even when OSV and GHSA agree, for example when the local NVD CVE is absent. That distinction is intentional.

Official reference formats: [OSV schema](https://ossf.github.io/osv-schema/), [GitHub global advisories API](https://docs.github.com/en/rest/security-advisories/global-advisories?apiVersion=2022-11-28), [npm semver](https://github.com/npm/node-semver), and [NVD API 2.0](https://nvd.nist.gov/developers/vulnerabilities).

## Status and remediation semantics

- `COMPLETED`: all inventoried packages and requested source lookups completed with no warnings.
- `COMPLETED_WITH_WARNINGS`: lookup coverage completed, but one or more matches need review or source data is not comparable.
- `INCOMPLETE`: lockfile coverage or one or more source lookups failed or exceeded a processing limit.
- `FAILED`: the inventory exists, but the primary OSV query did not complete any package lookup.
- `RESOLVED` is only assigned when a previously confirmed finding is absent from a fully `COMPLETED` rescan for the same named project and that package remains in the scanned lockfile at the same location. Missing project identity, changed scope, or an unconfirmed prior candidate remains `Unverified`.
- Upgrade commands are emitted only from valid fixed versions in advisory data. Conflicting source fixes suppress the automatic command. Temporary mitigation is left empty unless a source provides verifiable instructions.

Every scan report stores a JSON audit trail with scan ID, timestamp, stage, package/version/CVE, source, affected range, decision, reason, retry count, sanitized API error category, duration, and final status. Logs use an allow-listed JSON schema and do not include request headers, API tokens, uploaded file content, or raw provider bodies.

CVE translation masks CVE/CWE IDs, CVSS vectors, version strings, URLs, and the CVE's vendor/product names before calling the provider. The translated response is rejected if any marker was changed or dropped, leaving the source-language description available. This protects technical tokens; it does not prove that a machine translation preserves every sentence's technical meaning, so high-impact descriptions still benefit from human review.

## Golden corpus and measured results

`__tests__/fixtures/npm-scanner-golden.json` pins affected and fixed boundaries from public GitHub Security Advisories for lodash, minimist, semver, tough-cookie, and send. It includes direct/transitive labels, similar package names, an unsupported Git range, and a contradictory range. Source references are included in every row.

Current matching-only result on this curated corpus:

| Metric | Result |
| --- | ---: |
| True positive | 8 |
| False positive | 0 |
| True negative | 10 |
| False negative | 0 |
| Unverified / conflict cases, excluded from confusion-matrix denominators | 2 |
| Precision | 100% |
| Recall | 100% |
| False positive rate | 0% |
| False negative rate | 0% |
| F1 score | 100% |
| Scanner classification on all 20 fixture candidates | 0 Confirmed, 19 Needs Review, 1 Unverified |

These figures describe only the 18 determinate, hand-picked range-matching examples in the fixture. They are not representative production accuracy estimates: advisory candidates are supplied to the matcher, so these results do not measure OSV's discovery recall, live source availability, or vendor-page extraction. The other 2 cases have unknown/conflicting ground truth and are excluded from the confusion-matrix denominator. Because the fixture's NVD identity is deliberately not comparable, the scanner correctly keeps even agreeing OSV/GHSA cases under review. The requested 98% precision / 95% recall target is therefore **not established for real-world scans** by this corpus.

## Reproducible checks

Run from the repository root with the in-memory test database:

```powershell
$env:TEST_DB = 'memory'
npm test -- __tests__/npm-scanner-golden.test.ts __tests__/npm-scanner.test.ts __tests__/osv-client.test.ts __tests__/github-advisory-client.test.ts __tests__/scanner-upload.test.ts __tests__/translation-provider.test.ts __tests__/scan-verification-report.test.ts __tests__/scanner-audit.test.ts
npm run typecheck
npm run lint
npm run build
```

The tests include SemVer oracle comparisons, deterministic generated-input fuzz cases, exact package/PURL and source-conflict regressions, API retry/failure paths, inert upload checks, translation identifier preservation, rescan verification, and report/audit consistency. Live NVD, OSV, GitHub, and vendor behavior still needs a manual staging check with outbound access and representative lockfiles.
