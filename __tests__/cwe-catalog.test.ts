import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { getCweName } from "@/lib/cwe-catalog";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CWE catalog", () => {
  it("returns the unknown identifier without inventing a generic weakness name", () => {
    expect(getCweName("CWE-999999")).toBe("CWE-999999");
  });

  it("generates entries from quoted CSV fields and preserves the requested CWE-74 wording", async () => {
    const directory = await mkdtemp(join(tmpdir(), "infocve-cwe-"));
    temporaryDirectories.push(directory);
    const input = join(directory, "cwe.csv");
    const output = join(directory, "catalog.json");
    await writeFile(input, 'CWE-ID,Name,Other\n74,"Original name, with comma",ignored\n7,"Quoted ""name""",ignored\nNVD-CWE-noinfo,No info,ignored\n', "utf8");

    execFileSync(process.execPath, ["scripts/gen-cwe.mjs", input, output], { cwd: process.cwd() });
    const generated = JSON.parse(await readFile(output, "utf8")) as Record<string, string>;
    expect(generated["CWE-7"]).toBe('Quoted "name"');
    expect(generated["CWE-74"]).toBe("Improper Neutralization of Special Elements in Output Used by a Downstream Component ('Injection')");
    expect(generated["NVD-CWE-noinfo"]).toBeUndefined();
  });
});
