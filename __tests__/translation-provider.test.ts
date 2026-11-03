import { afterEach, describe, expect, it, vi } from "vitest";
import { createLibreTranslateBatchProvider, createLibreTranslateProvider, protectTechnicalIdentifiers, translateBatchWithRetry, translateProtectedBatch, translateProtectedText, translateWithRetry } from "@/lib/translation/provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CVE translation provider", () => {
  it("translates a batch and restores each description's protected identifiers", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { q: string[] };
      return Response.json({ translatedText: body.q.map((text) => text.replace(" vuln ", " kerentanan ")) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = createLibreTranslateBatchProvider({ endpoint: "https://translate.example/translate", timeoutMs: 1000 });

    await expect(translateProtectedBatch([
      { text: "VendorOne vuln CVE-2024-1234", identifiers: ["VendorOne"] },
      { text: "VendorTwo vuln CWE-79", identifiers: ["VendorTwo"] },
    ], provider)).resolves.toEqual([
      "VendorOne kerentanan CVE-2024-1234",
      "VendorTwo kerentanan CWE-79",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)) as { q: string[] };
    expect(body.q).toHaveLength(2);
  });

  it("fails the whole batch if the provider changes a protected marker", async () => {
    await expect(translateProtectedBatch([{ text: "CVE-2024-1234" }], async () => ["tanpa marker"]))
      .rejects.toThrow(/protected technical identifiers/);
  });

  it("retries a transient failure for the batch as one unit", async () => {
    let attempts = 0;
    const translated = await translateBatchWithRetry([{ text: "CVE-2024-1234" }], async (texts) => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("temporarily unavailable"), { retryable: true });
      return texts;
    }, { attempts: 2, delayMs: 0 });
    expect(attempts).toBe(2);
    expect(translated).toEqual(["CVE-2024-1234"]);
  });

  it("retries transient provider failures and returns the Indonesian text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ translatedText: "Kerentanan memungkinkan eksekusi kode." }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createLibreTranslateProvider({ endpoint: "https://translate.example/translate" });
    const translated = await translateWithRetry("A vulnerability allows code execution.", provider, {
      attempts: 2,
      delayMs: 0,
    });

    expect(translated).toBe("Kerentanan memungkinkan eksekusi kode.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects empty and malformed provider responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ translatedText: "   " })));
    const provider = createLibreTranslateProvider({ endpoint: "https://translate.example/translate" });

    await expect(provider("A CVE description.")).rejects.toThrow("empty translation");
  });

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("invalid request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createLibreTranslateProvider({ endpoint: "https://translate.example/translate" });

    await expect(translateWithRetry("Text", provider, { attempts: 3, delayMs: 0 })).rejects.toThrow("HTTP 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves CVE/CWE/CVSS, versions, URLs, and supplied product names verbatim", async () => {
    const source = "CVE-2021-44228 affects Apache Log4j 2.14.1 (CWE-502), CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H. See https://example.com/advisory.";
    const masked = protectTechnicalIdentifiers(source, ["Apache Log4j"]);
    const translated = await translateProtectedText(source, async (text) => {
      expect(text).not.toContain("CVE-2021-44228");
      expect(text).not.toContain("Apache Log4j");
      return text.replace("affects", "memengaruhi");
    }, ["Apache Log4j"]);

    expect(masked.markers.length).toBeGreaterThanOrEqual(5);
    expect(translated).toContain("CVE-2021-44228");
    expect(translated).toContain("CWE-502");
    expect(translated).toContain("2.14.1");
    expect(translated).toContain("Apache Log4j");
    expect(translated).toContain("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
    expect(translated).toContain("https://example.com/advisory");
  });

  it("restores protected text containing JavaScript replacement tokens literally", async () => {
    const text = "Product $& and $' are literal package names.";
    const restored = await translateProtectedText(text, async (masked) => masked, ["$&", "$'"]);
    expect(restored).toBe(text);
  });

  it("rejects a translation that drops, duplicates, or mutates a protected technical token", async () => {
    await expect(translateProtectedText("CVE-2021-44228 affects version 2.14.1", async () => "CVE-2021-44228 memengaruhi versi 2.14.1"))
      .rejects.toThrow("technical identifiers");
  });
});
