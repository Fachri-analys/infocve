import { afterEach, describe, expect, it, vi } from "vitest";
import { createLibreTranslateProvider, protectTechnicalIdentifiers, translateProtectedText, translateWithRetry } from "@/lib/translation/provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CVE translation provider", () => {
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

  it("rejects a translation that drops, duplicates, or mutates a protected technical token", async () => {
    await expect(translateProtectedText("CVE-2021-44228 affects version 2.14.1", async () => "CVE-2021-44228 memengaruhi versi 2.14.1"))
      .rejects.toThrow("technical identifiers");
  });
});
