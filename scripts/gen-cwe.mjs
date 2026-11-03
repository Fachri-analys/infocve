import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

export function buildCatalog(csvText) {
  const [header, ...rows] = parseCsv(csvText);
  if (!header || header[0] !== "CWE-ID" || header[1] !== "Name") {
    throw new Error("CSV MITRE CWE tidak memiliki kolom CWE-ID dan Name yang diharapkan.");
  }

  const catalog = {};
  for (const row of rows) {
    const numericId = row[0]?.trim();
    const name = row[1]?.trim();
    if (!numericId || !/^\d+$/.test(numericId) || !name) continue;
    catalog[`CWE-${Number(numericId)}`] = name;
  }

  catalog["CWE-74"] = "Improper Neutralization of Special Elements in Output Used by a Downstream Component ('Injection')";
  return Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4))));
}

async function main() {
  const input = process.argv[2];
  const output = process.argv[3] ?? "lib/cwe-catalog.json";
  if (!input) {
    throw new Error("Pemakaian: node scripts/gen-cwe.mjs <MITRE-CSV> [output.json]");
  }
  const catalog = buildCatalog(await readFile(resolve(input), "utf8"));
  await writeFile(resolve(output), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated ${Object.keys(catalog).length} CWE entries: ${resolve(output)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
