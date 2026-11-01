import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDb, closeDb } from "@/lib/db";
import { NotificationEngine, validateWebhookUrl } from "@/lib/notifications/notification-engine";
import type { CVE } from "@/types/cve";

describe("Notification Engine", () => {
  beforeAll(() => {
    process.env.TEST_DB = "memory";
  });

  it("initializes database connection", () => {
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("manages notification ON/OFF state correctly", () => {
    NotificationEngine.setEnabled(true, "https://hooks.example.com/test");
    expect(NotificationEngine.isEnabled()).toBe(true);

    NotificationEngine.setEnabled(false);
    expect(NotificationEngine.isEnabled()).toBe(false);
  });

  describe("Webhook URL validation and SSRF protection", () => {
    it("rejects non-HTTPS URLs", () => {
      expect(validateWebhookUrl("http://hooks.example.com/webhook").valid).toBe(false);
      expect(validateWebhookUrl("ftp://hooks.example.com/webhook").valid).toBe(false);
    });

    it("rejects localhost and loopback addresses", () => {
      expect(validateWebhookUrl("https://localhost/webhook").valid).toBe(false);
      expect(validateWebhookUrl("https://sub.localhost/webhook").valid).toBe(false);
      expect(validateWebhookUrl("https://127.0.0.1/webhook").valid).toBe(false);
      expect(validateWebhookUrl("https://[::1]/webhook").valid).toBe(false);
    });

    it("rejects private and link-local IP addresses", () => {
      expect(validateWebhookUrl("https://10.0.0.1/webhook").valid).toBe(false);
      expect(validateWebhookUrl("https://192.168.1.100/webhook").valid).toBe(false);
      expect(validateWebhookUrl("https://172.16.5.4/webhook").valid).toBe(false);
      expect(validateWebhookUrl("https://169.254.169.254/latest/meta-data").valid).toBe(false);
    });

    it("allows valid public HTTPS URLs and extracts host", () => {
      const res = validateWebhookUrl("https://discord.com/api/webhooks/123/token-secret");
      expect(res.valid).toBe(true);
      expect(res.host).toBe("discord.com");
    });
  });

  describe("Deduplication and logging", () => {
    const mockCve: CVE = {
      id: "CVE-2024-9999",
      title: "Test Vulnerability",
      descriptionEn: "Test description",
      descriptionId: "Deskripsi tes",
      publishedDate: "2024-01-01T00:00:00Z",
      lastModifiedDate: "2024-01-02T00:00:00Z",
      vendor: "VendorTest",
      product: "ProductTest",
      affected: [],
      category: "web-application",
      year: 2024,
      cvss: {
        version: "3.1",
        baseScore: 9.8,
        severity: "CRITICAL",
        vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        attackVector: "NETWORK",
        attackComplexity: "LOW",
        privilegesRequired: "NONE",
        userInteraction: "NONE",
        scope: "UNCHANGED",
        confidentialityImpact: "HIGH",
        integrityImpact: "HIGH",
        availabilityImpact: "HIGH",
      },
      cwe: [],
      references: [],
      sources: ["NVD"],
    };

    it("prevents SSRF dispatch and logs host only without full URL path", async () => {
      NotificationEngine.setEnabled(true, "https://127.0.0.1/private-path?token=secret123");
      const dispatched = await NotificationEngine.dispatchVulnerabilityAlert(mockCve);
      expect(dispatched).toBe(false);

      const db = getDb();
      const log = db.prepare("SELECT * FROM notification_logs WHERE cve_id = ?").get(mockCve.id) as
        | { target: string; status: string }
        | undefined;
      expect(log).toBeDefined();
      expect(log?.target).toBe("127.0.0.1");
      expect(log?.target).not.toContain("private-path");
      expect(log?.target).not.toContain("secret123");
      expect(log?.status).toBe("REJECTED_SSRF");
    });

    it("deduplicates alerts for already-sent CVE IDs", async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO notification_logs (cve_id, event_type, target, status, sent_at)
        VALUES (?, 'WEBHOOK', 'discord.com', 'SENT', ?)
      `).run("CVE-2024-1111", new Date().toISOString());

      expect(NotificationEngine.isAlertAlreadySent("CVE-2024-1111")).toBe(true);
      const res = await NotificationEngine.dispatchVulnerabilityAlert({
        ...mockCve,
        id: "CVE-2024-1111",
      });
      expect(res).toBe(false);
    });
  });

  afterAll(() => {
    closeDb();
    delete process.env.TEST_DB;
  });
});
