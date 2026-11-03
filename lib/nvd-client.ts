import "server-only";

import type { NvdCveApiResponse, NvdQueryParams } from "@/lib/nvd-types";

const NVD_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 2_000;

export type NvdErrorKind =
  | "timeout"
  | "network"
  | "rate-limit"
  | "invalid-request"
  | "auth"
  | "server"
  | "invalid-response"
  | "unknown";

const FRIENDLY_MESSAGES_ID: Record<NvdErrorKind, string> = {
  timeout: "Permintaan ke basis data NVD memakan waktu terlalu lama. Silakan coba lagi sebentar lagi.",
  network: "Tidak dapat terhubung ke basis data NVD saat ini. Periksa koneksi jaringan server dan coba lagi.",
  "rate-limit": "Terlalu banyak permintaan ke NVD dalam waktu singkat. Silakan tunggu sebentar lalu coba lagi.",
  "invalid-request": "Permintaan pencarian tidak valid — coba sederhanakan kombinasi filter yang dipakai.",
  auth: "Kunci API NVD (NVD_API_KEY) tidak valid. Periksa kembali nilainya, atau hapus untuk memakai mode tanpa kunci.",
  server: "Basis data NVD sedang mengalami gangguan di sisi mereka. Silakan coba lagi nanti.",
  "invalid-response": "Basis data NVD memberi respons yang tidak sesuai dugaan.",
  unknown: "Terjadi kesalahan tak terduga saat mengambil data dari NVD.",
};

/** A normalized, friendly-message-carrying error for every NVD failure mode. */
export class NvdApiError extends Error {
  readonly kind: NvdErrorKind;
  readonly status?: number;

  constructor(kind: NvdErrorKind, status?: number, detail?: string) {
    const base = FRIENDLY_MESSAGES_ID[kind];
    const context = [status ? `HTTP ${status}` : undefined, detail].filter(Boolean).join(": ");
    super(context ? `${base} (${context})` : base);
    this.name = "NvdApiError";
    this.kind = kind;
    this.status = status;
  }
}

function buildUrl(params: NvdQueryParams): string {
  const url = new URL(NVD_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, capped — avoids a thundering-herd retry pattern. */
function backoffDelay(attempt: number): number {
  const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = exponential * 0.2 * Math.random();
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

function classifyStatus(status: number): NvdErrorKind {
  if (status === 429) return "rate-limit";
  if (status === 403) return "auth";
  if (status === 400 || status === 404) return "invalid-request";
  if (status >= 500) return "server";
  return "unknown";
}

/** Only network hiccups, timeouts, rate limits, and server errors are worth retrying — a bad request or bad key never will be. */
function isRetryableKind(kind: NvdErrorKind): boolean {
  return kind === "timeout" || kind === "network" || kind === "rate-limit" || kind === "server";
}

export function getNvdErrorDetail(headers: Headers, body: unknown): string | undefined {
  const headerMessage = headers.get("message")?.trim();
  if (headerMessage) return headerMessage.slice(0, 500);
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message.slice(0, 500);
  }
  return undefined;
}

async function safeParseErrorBody(response: Response): Promise<string | undefined> {
  try {
    const json = (await response.json()) as unknown;
    return getNvdErrorDetail(response.headers, json);
  } catch {
    return getNvdErrorDetail(response.headers, null);
  }
}

/** Guards against a 200 response that isn't shaped the way we expect — better a clear error than a crash deep inside the normalizer. */
function validateCveResponse(json: unknown): NvdCveApiResponse {
  if (
    !json ||
    typeof json !== "object" ||
    !("vulnerabilities" in json) ||
    !Array.isArray((json as { vulnerabilities: unknown }).vulnerabilities) ||
    !("totalResults" in json) ||
    typeof (json as { totalResults: unknown }).totalResults !== "number"
  ) {
    throw new NvdApiError("invalid-response");
  }
  return json as NvdCveApiResponse;
}

interface FetchNvdOptions {
  /** AbortController timeout per attempt, in ms. */
  timeoutMs?: number;
  /** Next.js `fetch` cache revalidation window, in seconds. */
  revalidateSeconds?: number;
  /** Extra cache tags, for future on-demand revalidation. */
  tags?: string[];
  /** Avoid Next data cache for the scheduled sync pipeline. */
  noStore?: boolean;
  /** Override the retry count for bounded scheduled jobs. */
  maxAttempts?: number;
  /** Cap Retry-After delays so scheduled functions remain within their runtime budget. */
  maxRetryDelayMs?: number;
}

/**
 * Calls `GET https://services.nvd.nist.gov/rest/json/cves/2.0` — the only
 * official NVD REST API v2.0 endpoint this app uses. Never scrapes, never
 * touches an unofficial mirror.
 *
 * - Reads `NVD_API_KEY` from the environment and sends it as the `apiKey`
 *   header (NVD's documented auth mechanism — never a query param, never
 *   exposed to the client since this module is `server-only`). If the key
 *   is absent, requests are sent unauthenticated (5 req/30s instead of
 *   50/30s) rather than failing.
 * - Times out each attempt via `AbortController` and retries timeouts,
 *   network errors, HTTP 429, and HTTP 5xx with exponential backoff +
 *   jitter (honoring a `Retry-After` header when NVD sends one). It never
 *   retries 400/403/404 — retrying an invalid request or bad key only
 *   burns rate-limit budget for a result that won't change.
 * - Uses Next.js's `fetch` cache (`next.revalidate`) so repeated calls for
 *   the same query within the window are served from cache instead of
 *   hitting NVD again — this is the primary defense against rate limits
 *   under real traffic, on top of the retry logic above.
 */
export async function fetchNvd(params: NvdQueryParams, options: FetchNvdOptions = {}): Promise<NvdCveApiResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const revalidate = options.revalidateSeconds ?? 3600;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? MAX_ATTEMPTS, MAX_ATTEMPTS));
  const maxRetryDelayMs = Math.max(0, options.maxRetryDelayMs ?? MAX_RETRY_DELAY_MS);
  const url = buildUrl(params);
  const apiKey = process.env.NVD_API_KEY?.trim();
  const headers: HeadersInit = {
    "User-Agent": "InfoCVE/0.1.0 (Security Intelligence Platform)",
    ...(apiKey ? { apiKey } : {}),
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        ...(options.noStore ? { cache: "no-store" as const } : { next: { revalidate, tags: ["nvd", ...(options.tags ?? [])] } }),
      });

      if (response.ok) {
        const json = await response.json();
        return validateCveResponse(json);
      }

      const kind = classifyStatus(response.status);
      const errorBody = await safeParseErrorBody(response);
      const isLastAttempt = attempt === maxAttempts - 1;

      if (!isRetryableKind(kind) || isLastAttempt) {
      throw new NvdApiError(kind, response.status, errorBody);
      }

      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = retryAfter === null ? NaN : Number(retryAfter) * 1000;
      await sleep(Math.min(Number.isFinite(retryAfterMs) ? retryAfterMs : backoffDelay(attempt), maxRetryDelayMs));
    } catch (error) {
      if (error instanceof NvdApiError) throw error;

      const isAbort = error instanceof Error && error.name === "AbortError";
      const kind: NvdErrorKind = isAbort ? "timeout" : "network";
      const isLastAttempt = attempt === maxAttempts - 1;

      if (isLastAttempt) throw new NvdApiError(kind);
      await sleep(backoffDelay(attempt));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  // Unreachable in practice (the loop always throws or returns), but keeps
  // the function's return type honest for TypeScript.
  throw new NvdApiError("unknown");
}
