import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface OgFontConfig {
  name: string;
  data: ArrayBuffer | Buffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}

let cachedFontConfigs: OgFontConfig[] | null = null;

/**
 * Loads IBM Plex Sans and IBM Plex Mono fonts locally from `assets/fonts/`
 * (with fallback to `node_modules/@fontsource/*`), avoiding any runtime or
 * build-time HTTP requests to cdn.jsdelivr.net.
 */
export async function getLocalOgFonts(): Promise<OgFontConfig[]> {
  if (cachedFontConfigs) {
    return cachedFontConfigs;
  }

  const assetDir = join(process.cwd(), "assets", "fonts");
  const moduleDir = join(process.cwd(), "node_modules");

  const loadFont = async (fileName: string, fallbackPath: string): Promise<Buffer> => {
    try {
      return await readFile(join(assetDir, fileName));
    } catch {
      return await readFile(join(moduleDir, fallbackPath));
    }
  };

  const [sans400, sans600, sans700, mono400] = await Promise.all([
    loadFont(
      "ibm-plex-sans-latin-400-normal.woff",
      "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff"
    ),
    loadFont(
      "ibm-plex-sans-latin-600-normal.woff",
      "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff"
    ),
    loadFont(
      "ibm-plex-sans-latin-700-normal.woff",
      "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff"
    ),
    loadFont(
      "ibm-plex-mono-latin-400-normal.woff",
      "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff"
    ),
  ]);

  cachedFontConfigs = [
    {
      name: "IBM Plex Sans",
      data: sans400,
      weight: 400,
      style: "normal",
    },
    {
      name: "IBM Plex Sans",
      data: sans600,
      weight: 600,
      style: "normal",
    },
    {
      name: "IBM Plex Sans",
      data: sans700,
      weight: 700,
      style: "normal",
    },
    {
      name: "IBM Plex Mono",
      data: mono400,
      weight: 400,
      style: "normal",
    },
  ];

  return cachedFontConfigs;
}
