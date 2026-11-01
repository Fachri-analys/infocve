import { describe, expect, it } from "vitest";
import { readNpmScanUpload, ScanUploadError } from "@/lib/scanner/upload";

function requestFor(manifest: string, lock: string): Request {
  const form = new FormData();
  form.set("packageJson", new File([manifest], "package.json", { type: "application/json" }));
  form.set("packageLockJson", new File([lock], "package-lock.json", { type: "application/json" }));
  return new Request("http://localhost/api/dependency-scans", { method: "POST", body: form });
}

describe("npm scanner upload boundary", () => {
  it("accepts JSON as inert data and does not execute package scripts", async () => {
    const sentinel = "process.env.INFOCVE_UPLOAD_SENTINEL = 'executed'";
    delete process.env.INFOCVE_UPLOAD_SENTINEL;
    const result = await readNpmScanUpload(requestFor(
      JSON.stringify({ name: "demo", scripts: { preinstall: sentinel }, dependencies: {} }),
      JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "demo" } } })
    ));

    expect(result.manifest.name).toBe("demo");
    expect(process.env.INFOCVE_UPLOAD_SENTINEL).toBeUndefined();
  });

  it("rejects malformed JSON and duplicate file fields", async () => {
    await expect(readNpmScanUpload(requestFor("{", "{\"lockfileVersion\":3,\"packages\":{\"\":{}}}")))
      .rejects.toBeInstanceOf(ScanUploadError);

    const form = new FormData();
    form.append("packageJson", new File(["{}"], "one.json"));
    form.append("packageJson", new File(["{}"], "two.json"));
    form.append("packageLockJson", new File(["{\"lockfileVersion\":3,\"packages\":{\"\":{}}}"], "package-lock.json"));
    await expect(readNpmScanUpload(new Request("http://localhost", { method: "POST", body: form })))
      .rejects.toThrow("wajib diunggah satu kali");
  });

  it("enforces per-file size limits before JSON parsing", async () => {
    const tooLarge = JSON.stringify({ padding: "x".repeat(1024 * 1024 + 1) });
    await expect(readNpmScanUpload(requestFor(tooLarge, "{\"lockfileVersion\":3,\"packages\":{\"\":{}}}")))
      .rejects.toMatchObject({ status: 413 });
  });

  describe("lockfile rusak (corrupted / invalid lockfile)", () => {
    it("rejects lockfile containing broken JSON syntax", async () => {
      await expect(
        readNpmScanUpload(requestFor("{}", "{ broken json lockfile"))
      ).rejects.toMatchObject({
        message: expect.stringContaining("bukan JSON UTF-8 yang valid"),
        status: 400,
      });
    });

    it("rejects lockfile when root is an array instead of an object", async () => {
      await expect(
        readNpmScanUpload(requestFor("{}", "[]"))
      ).rejects.toMatchObject({
        message: expect.stringContaining("Kedua file harus berisi objek JSON"),
        status: 400,
      });
    });

    it("rejects lockfile missing both packages and dependencies", async () => {
      await expect(
        readNpmScanUpload(requestFor("{}", JSON.stringify({ name: "orphan-project" })))
      ).rejects.toMatchObject({
        message: expect.stringContaining("Lockfile tidak memiliki packages atau dependencies"),
        status: 400,
      });
    });

    it("rejects lockfile with invalid entry data types", async () => {
      const corruptLock = {
        lockfileVersion: 3,
        packages: {
          "": {},
          "node_modules/bad-pkg": { version: 12345 }, // version should be a string
        },
      };
      await expect(
        readNpmScanUpload(requestFor("{}", JSON.stringify(corruptLock)))
      ).rejects.toMatchObject({
        message: expect.stringContaining("Nama atau versi package di lockfile tidak valid"),
        status: 400,
      });
    });
  });

  describe("lockfile melewati batas (boundary & resource limit violations)", () => {
    it("rejects lockfile exceeding 1 MB individual file limit with 413", async () => {
      const hugeLock = JSON.stringify({
        lockfileVersion: 3,
        packages: { "": {} },
        comment: "a".repeat(1024 * 1024 + 50),
      });
      await expect(
        readNpmScanUpload(requestFor("{}", hugeLock))
      ).rejects.toMatchObject({
        message: expect.stringContaining("Setiap file dibatasi hingga 1 MB"),
        status: 413,
      });
    });

    it("rejects lockfile with more than 20,000 package entries with 413", async () => {
      const packages: Record<string, { version: string }> = { "": { version: "1.0.0" } };
      for (let i = 0; i < 20_005; i++) {
        packages[`node_modules/pkg-${i}`] = { version: "1.0.0" };
      }
      const lockData = {
        lockfileVersion: 3,
        packages,
      };

      await expect(
        readNpmScanUpload(requestFor("{}", JSON.stringify(lockData)))
      ).rejects.toMatchObject({
        message: expect.stringContaining("terlalu banyak entri package"),
        status: 413,
      });
    });

    it("rejects v1 lockfile exceeding maximum depth of 100 with 413", async () => {
      // Build a deeply nested tree exceeding depth 100
      let current: Record<string, unknown> = { version: "1.0.0" };
      const root: Record<string, unknown> = { "deep-pkg-0": current };
      for (let depth = 1; depth <= 105; depth++) {
        const next: Record<string, unknown> = { version: "1.0.0" };
        current.dependencies = { [`deep-pkg-${depth}`]: next };
        current = next;
      }
      const deepLock = {
        lockfileVersion: 1,
        dependencies: root,
      };

      await expect(
        readNpmScanUpload(requestFor("{}", JSON.stringify(deepLock)))
      ).rejects.toMatchObject({
        message: expect.stringContaining("Pohon dependency melewati batas kedalaman 100"),
        status: 413,
      });
    });
  });
});
