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
});
