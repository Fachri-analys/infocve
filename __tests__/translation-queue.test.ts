import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CVE } from "@/types/cve";

let dbModule: typeof import("@/lib/db");
let CveRepository: typeof import("@/lib/db/cve-repository").CveRepository;
let enqueueCveTranslation: typeof import("@/lib/translation/queue").enqueueCveTranslation;
let processPendingTranslations: typeof import("@/lib/translation/queue").processPendingTranslations;

beforeAll(async () => {
  process.env.TEST_DB = "memory";
  dbModule = await import("@/lib/db");
  ({ CveRepository } = await import("@/lib/db/cve-repository"));
  ({ enqueueCveTranslation, processPendingTranslations } = await import("@/lib/translation/queue"));
  dbModule.getDb();
});

afterAll(() => {
  dbModule.closeDb();
  delete process.env.TEST_DB;
  delete process.env.INFOCVE_TRANSLATION_URL;
  delete process.env.INFOCVE_TRANSLATION_RETRY_DELAY_MS;
  vi.unstubAllGlobals();
});

const makeCve = (id: string, descriptionEn: string): CVE => ({
  id,
  title: "Example vulnerability",
  year: 2026,
  publishedDate: "2026-01-01T00:00:00.000Z",
  lastModifiedDate: "2026-01-01T00:00:00.000Z",
  descriptionEn,
  descriptionId: "Bantuan istilah keamanan.",
  vendor: "Example",
  product: "Example package",
  category: "framework-library",
  cvss: {
    version: "3.1", baseScore: 7.5, severity: "HIGH", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    attackVector: "NETWORK", attackComplexity: "LOW", privilegesRequired: "NONE", userInteraction: "NONE",
    scope: "UNCHANGED", confidentialityImpact: "HIGH", integrityImpact: "NONE", availabilityImpact: "NONE",
  },
  cwe: [], affected: [], references: [],
});

describe("persistent CVE translation queue", () => {
  it("stores translated descriptions and reuses cached text for another CVE", async () => {
    const description = "A vulnerability allows remote code execution.";
    CveRepository.upsert(makeCve("CVE-2026-70001", description));
    enqueueCveTranslation("CVE-2026-70001", description);

    process.env.INFOCVE_TRANSLATION_URL = "https://translate.example/translate";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ translatedText: "Kerentanan memungkinkan eksekusi kode jarak jauh." }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await processPendingTranslations();

    expect(result).toEqual({ translated: 1, failed: 0 });
    expect(CveRepository.getById("CVE-2026-70001")).toMatchObject({
      descriptionId: "Kerentanan memungkinkan eksekusi kode jarak jauh.",
      translationStatus: "TRANSLATED",
    });

    CveRepository.upsert(makeCve("CVE-2026-70001", description));
    enqueueCveTranslation("CVE-2026-70001", description);
    expect(CveRepository.getById("CVE-2026-70001")?.translationStatus).toBe("TRANSLATED");

    CveRepository.upsert(makeCve("CVE-2026-70002", description));
    enqueueCveTranslation("CVE-2026-70002", description);
    expect(CveRepository.getById("CVE-2026-70002")).toMatchObject({
      descriptionId: "Kerentanan memungkinkan eksekusi kode jarak jauh.",
      translationStatus: "TRANSLATED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("records provider failure without losing the source CVE", async () => {
    const description = "A separate vulnerability allows denial of service.";
    CveRepository.upsert(makeCve("CVE-2026-70003", description));
    enqueueCveTranslation("CVE-2026-70003", description);
    process.env.INFOCVE_TRANSLATION_URL = "https://translate.example/translate";
    process.env.INFOCVE_TRANSLATION_RETRY_DELAY_MS = "0";
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await processPendingTranslations();

    expect(result).toEqual({ translated: 0, failed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(CveRepository.getById("CVE-2026-70003")).toMatchObject({
      descriptionEn: description,
      translationStatus: "FAILED",
    });
  });

  it("keeps identifiers, CVSS vectors, product names, and versions intact in queued translations", async () => {
    const description = "CVE-2026-70004 affects Example package 2.4.1 (CWE-79), CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N.";
    CveRepository.upsert(makeCve("CVE-2026-70004", description));
    enqueueCveTranslation("CVE-2026-70004", description);
    process.env.INFOCVE_TRANSLATION_URL = "https://translate.example/translate";
    process.env.INFOCVE_TRANSLATION_RETRY_DELAY_MS = "0";
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { q: string };
      expect(body.q).not.toContain("CVE-2026-70004");
      expect(body.q).not.toContain("Example package");
      expect(body.q).not.toContain("2.4.1");
      expect(body.q).not.toContain("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N");
      return Response.json({ translatedText: body.q.replace("affects", "memengaruhi") });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await processPendingTranslations();

    expect(result).toEqual({ translated: 1, failed: 0 });
    const translated = CveRepository.getById("CVE-2026-70004")?.descriptionId ?? "";
    expect(translated).toContain("CVE-2026-70004");
    expect(translated).toContain("Example package 2.4.1 (CWE-79)");
    expect(translated).toContain("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N");
  });

  it("rejects a provider response that corrupts a protected identifier and leaves the English source intact", async () => {
    const description = "CVE-2026-70005 affects Example package 2.4.1.";
    CveRepository.upsert(makeCve("CVE-2026-70005", description));
    enqueueCveTranslation("CVE-2026-70005", description);
    process.env.INFOCVE_TRANSLATION_URL = "https://translate.example/translate";
    process.env.INFOCVE_TRANSLATION_RETRY_DELAY_MS = "0";
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { q: string };
      return Response.json({ translatedText: body.q.replace("INFOTOKEN", "INFOTOKFN") });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await processPendingTranslations();

    expect(result).toEqual({ translated: 0, failed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(CveRepository.getById("CVE-2026-70005")).toMatchObject({
      descriptionEn: description,
      translationStatus: "FAILED",
    });
  });
});
