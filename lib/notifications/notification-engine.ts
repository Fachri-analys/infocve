import { getDb } from "@/lib/db";
import { CVE } from "@/types/cve";

export interface NotificationPayload {
  cveId: string;
  title: string;
  severity: string;
  score?: number;
  isCisaKev: boolean;
  hasPoc: boolean;
  publishedDate: string;
  url: string;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (host === "localhost" || host.endsWith(".localhost") || host === "local") {
    return true;
  }

  // IPv6 loopback, unspecified, link-local, unique-local
  if (
    host === "::1" ||
    host === "::" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("[::1]") ||
    host.startsWith("[fe80:")
  ) {
    return true;
  }

  // IPv4 dotted-decimal
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const octets = match.slice(1, 5).map(Number);
    if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const o1 = octets[0]!;
    const o2 = octets[1]!;
    if (o1 === 0) return true; // 0.0.0.0/8
    if (o1 === 10) return true; // 10.0.0.0/8
    if (o1 === 127) return true; // 127.0.0.0/8
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
    if (o1 >= 224) return true; // 224.0.0.0/4 multicast & reserved
  }

  return false;
}

export function validateWebhookUrl(urlStr: string): { valid: boolean; host: string; error?: string } {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.host || "unknown";

    if (parsed.protocol !== "https:") {
      return { valid: false, host, error: "Webhook URL wajib menggunakan protokol HTTPS" };
    }

    if (isPrivateOrLocalHost(parsed.hostname)) {
      return { valid: false, host, error: "Alamat IP privat, loopback, atau link-local tidak diizinkan" };
    }

    return { valid: true, host };
  } catch {
    return { valid: false, host: "invalid", error: "Format URL webhook tidak valid" };
  }
}

export class NotificationEngine {
  /**
   * Check if notifications are enabled
   */
  static isEnabled(): boolean {
    if (process.env.NOTIFICATIONS_ENABLED === "false" || process.env.NOTIFICATIONS_ENABLED === "0") {
      return false;
    }
    if (process.env.NOTIFICATIONS_ENABLED === "true" || process.env.NOTIFICATIONS_ENABLED === "1") {
      return true;
    }

    try {
      const db = getDb();
      const row = db.prepare("SELECT enabled FROM notification_settings WHERE id = 'default'").get() as { enabled?: number } | undefined;
      return (row?.enabled ?? 0) === 1;
    } catch {
      return false;
    }
  }

  /**
   * Set notifications enabled/disabled toggle
   */
  static setEnabled(enabled: boolean, webhookUrl?: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notification_settings (id, enabled, webhook_url, created_at, updated_at)
      VALUES ('default', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        enabled = excluded.enabled,
        webhook_url = COALESCE(excluded.webhook_url, notification_settings.webhook_url),
        updated_at = excluded.updated_at
    `).run(enabled ? 1 : 0, webhookUrl || null, now, now);
  }

  /**
   * Check if an alert for this cve_id has already been successfully sent
   */
  static isAlertAlreadySent(cveId: string): boolean {
    try {
      const db = getDb();
      const row = db.prepare(`
        SELECT id FROM notification_logs
        WHERE cve_id = ? AND status IN ('SENT', 'SUCCESS')
        LIMIT 1
      `).get(cveId);
      return !!row;
    } catch {
      return false;
    }
  }

  /**
   * Dispatch vulnerability alert to configured channels if enabled.
   * Enforces HTTPS validation, SSRF protection against private/loopback IPs,
   * disallows redirect following (redirect: "error"), deduplicates per cve_id,
   * stores only target host in logs, and uses NEXT_PUBLIC_SITE_URL.
   */
  static async dispatchVulnerabilityAlert(cve: CVE): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // Deduplicate alert per cve_id
    if (this.isAlertAlreadySent(cve.id)) {
      return false;
    }

    const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL || this.getWebhookUrl();
    if (!webhookUrl) {
      this.logNotification(cve.id, "WEBHOOK", "NO_WEBHOOK_CONFIGURED", "SKIPPED");
      return false;
    }

    // Validate HTTPS and reject private/loopback/link-local addresses
    const validation = validateWebhookUrl(webhookUrl);
    if (!validation.valid) {
      this.logNotification(cve.id, "WEBHOOK", validation.host, "REJECTED_SSRF", validation.error);
      return false;
    }

    const host = validation.host;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

    const payload: NotificationPayload = {
      cveId: cve.id,
      title: cve.title,
      severity: cve.cvss?.severity ?? "UNRATED",
      score: cve.cvss?.baseScore,
      isCisaKev: cve.cisaKev?.isKev ?? false,
      hasPoc: cve.hasPoc ?? false,
      publishedDate: cve.publishedDate,
      url: `${siteUrl}/cve/${cve.id}`,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 [InfoCVE Alert] ${cve.id} (${cve.cvss ? `${cve.cvss.severity} - ${cve.cvss.baseScore}` : "CVSS belum dinilai"}) detected!`,
          data: payload,
        }),
        redirect: "error",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const status = res.ok ? "SENT" : "FAILED";
      this.logNotification(cve.id, "WEBHOOK", host, status, res.ok ? undefined : `HTTP ${res.status}`);
      return res.ok;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logNotification(cve.id, "WEBHOOK", host, "ERROR", errorMsg);
      return false;
    }
  }

  private static getWebhookUrl(): string | null {
    try {
      const db = getDb();
      const row = db.prepare("SELECT webhook_url FROM notification_settings WHERE id = 'default'").get() as { webhook_url?: string } | undefined;
      return row?.webhook_url || null;
    } catch {
      return null;
    }
  }

  private static logNotification(cveId: string, eventType: string, targetHost: string, status: string, error?: string): void {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO notification_logs (cve_id, event_type, target, status, sent_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cveId, eventType, targetHost, status, new Date().toISOString(), error || null);
    } catch {
      // ignore
    }
  }
}
