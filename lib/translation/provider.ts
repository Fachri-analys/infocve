export interface TranslationProviderError extends Error {
  retryable: boolean;
  attempts?: number;
}

export type TranslationProvider = (text: string) => Promise<string>;

export interface ProtectedTranslationText {
  maskedText: string;
  markers: Array<{ marker: string; value: string }>;
}

const TECHNICAL_PATTERNS = [
  /\bCVE-\d{4}-\d{4,}\b/gi,
  /\bCWE-\d+\b/gi,
  /\bCVSS:[234]\.\d(?:\/[A-Z0-9:._-]+)+/gi,
  /https?:\/\/[^\s<>"']+/gi,
  /\bv?\d+\.(?:\d+|x|X|\*)(?:\.(?:\d+|x|X|\*))?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\b(?![A-Za-z0-9.-])/g,
];

/** Masks literal technical identifiers and caller-supplied vendor/product names around translation. */
export function protectTechnicalIdentifiers(text: string, identifiers: string[] = []): ProtectedTranslationText {
  const spans: Array<{ start: number; end: number; value: string }> = [];
  for (const pattern of TECHNICAL_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index !== undefined && match[0]) spans.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  for (const identifier of Array.from(new Set(identifiers)).filter((value) => value.trim().length >= 2).sort((a, b) => b.length - a.length)) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi");
    for (const match of text.matchAll(pattern)) {
      if (match.index !== undefined && match[0]) spans.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const selected: typeof spans = [];
  for (const span of spans) {
    const previous = selected.at(-1);
    if (!previous || span.start >= previous.end) selected.push(span);
  }
  const markers: ProtectedTranslationText["markers"] = [];
  let maskedText = "";
  let cursor = 0;
  for (const span of selected) {
    const marker = `INFOTOKENZXQ${String(markers.length).padStart(6, "0")}QXZ`;
    maskedText += `${text.slice(cursor, span.start)}${marker}`;
    markers.push({ marker, value: span.value });
    cursor = span.end;
  }
  maskedText += text.slice(cursor);
  return { maskedText, markers };
}

/** Fails closed to the source-language fallback if a provider changes a protected identifier. */
export async function translateProtectedText(
  text: string,
  provider: TranslationProvider,
  identifiers: string[] = []
): Promise<string> {
  const protectedText = protectTechnicalIdentifiers(text, identifiers);
  const translated = await provider(protectedText.maskedText);
  for (const { marker } of protectedText.markers) {
    if (translated.split(marker).length !== 2) throw providerError("Translation provider changed protected technical identifiers.", false);
  }
  let restored = translated;
  for (const { marker, value } of protectedText.markers) restored = restored.replace(marker, value);
  return restored;
}

interface LibreTranslateOptions {
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
}

export function createLibreTranslateProvider(options: LibreTranslateOptions): TranslationProvider {
  return async (text) => {
    const endpoint = new URL(options.endpoint);
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
      throw providerError("Translation endpoint must use HTTP or HTTPS.", false);
    }
    if (text.length === 0 || text.length > 20_000) {
      throw providerError("Translation text must contain between 1 and 20,000 characters.", false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          q: text,
          source: "en",
          target: "id",
          format: "text",
          ...(options.apiKey ? { api_key: options.apiKey } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw providerError(`Translation provider returned HTTP ${response.status}.`, response.status === 429 || response.status >= 500);
      }

      const payload: unknown = await response.json();
      const translatedText =
        payload && typeof payload === "object" && "translatedText" in payload
          ? (payload as { translatedText?: unknown }).translatedText
          : undefined;
      if (typeof translatedText !== "string" || !translatedText.trim()) {
        throw providerError("Translation provider returned an empty translation.", false);
      }
      return translatedText.trim();
    } catch (error) {
      if (isTranslationProviderError(error)) throw error;
      throw providerError(error instanceof Error && error.name === "AbortError" ? "Translation provider timed out." : "Translation provider is unavailable.", true);
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function translateWithRetry(
  text: string,
  provider: TranslationProvider,
  options: { attempts?: number; delayMs?: number; onAttempt?: (attempt: number) => void } = {}
): Promise<string> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 5));
  const delayMs = Math.max(0, options.delayMs ?? 400);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      options.onAttempt?.(attempt);
      return await provider(text);
    } catch (error) {
      const retryable = isTranslationProviderError(error) ? error.retryable : true;
      if (!retryable || attempt === attempts) {
        if (error instanceof Error) throw Object.assign(error, { attempts: attempt });
        throw providerError("Translation provider failed.", false);
      }
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** (attempt - 1)));
    }
  }
  throw providerError("Translation attempts were exhausted.", false);
}

function providerError(message: string, retryable: boolean): TranslationProviderError {
  return Object.assign(new Error(message), { name: "TranslationProviderError", retryable });
}

function isTranslationProviderError(error: unknown): error is TranslationProviderError {
  return error instanceof Error && "retryable" in error && typeof error.retryable === "boolean";
}
