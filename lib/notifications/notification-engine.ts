import { getDb } from "@/lib/db";
import { CVE } from "@/types/cve";

export interface NotificationPayload {
  cveId: string;
  title: string;
  severity: string;
  score: number;
  isCisaKev: boolean;
  hasPoc: boolean;
  publishedDate: string;
  url: string;
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
   * Dispatch vulnerability alert to configured channels if enabled
   */
  static async dispatchVulnerabilityAlert(cve: CVE): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const payload: NotificationPayload = {
      cveId: cve.id,
      title: cve.title,
      severity: cve.cvss.severity,
      score: cve.cvss.baseScore,
      isCisaKev: cve.cisaKev?.isKev ?? false,
      hasPoc: cve.hasPoc ?? false,
      publishedDate: cve.publishedDate,
      url: `https://infocve.com/cve/${cve.id}`,
    };

    const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL || this.getWebhookUrl();
    if (!webhookUrl) {
      this.logNotification(cve.id, "WEBHOOK", "NO_WEBHOOK_CONFIGURED", "SKIPPED");
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 [InfoCVE Alert] ${cve.id} (${cve.cvss.severity} - ${cve.cvss.baseScore}) detected!`,
          data: payload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const status = res.ok ? "SENT" : "FAILED";
      this.logNotification(cve.id, "WEBHOOK", webhookUrl, status, res.ok ? undefined : `HTTP ${res.status}`);
      return res.ok;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logNotification(cve.id, "WEBHOOK", webhookUrl, "ERROR", errorMsg);
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

  private static logNotification(cveId: string, eventType: string, target: string, status: string, error?: string): void {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO notification_logs (cve_id, event_type, target, status, sent_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cveId, eventType, target, status, new Date().toISOString(), error || null);
    } catch {
      // ignore
    }
  }
}
