import { describe, expect, it, afterAll } from "vitest";
import { getDb, closeDb } from "@/lib/db";
import { NotificationEngine } from "@/lib/notifications/notification-engine";

describe("Notification Engine", () => {
  // Ensure DB is initialized before tests
  it("initializes database connection", () => {
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("manages notification ON/OFF state correctly", () => {
    NotificationEngine.setEnabled(true, "https://webhook.site/test");
    expect(NotificationEngine.isEnabled()).toBe(true);

    NotificationEngine.setEnabled(false);
    expect(NotificationEngine.isEnabled()).toBe(false);
  });

  afterAll(() => {
    closeDb();
  });
});
