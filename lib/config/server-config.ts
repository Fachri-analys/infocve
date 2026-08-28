import "server-only";

/**
 * Server-only configuration management.
 * Guarantees zero secret exposure to client-side bundles.
 */

export interface ServerConfig {
  nvdApiKey?: string;
  githubToken?: string;
  syncIntervalMinutes: number;
  notificationsEnabled: boolean;
  notificationWebhookUrl?: string;
  dataDir: string;
  adminSecret?: string;
}

export function getServerConfig(): ServerConfig {
  return {
    nvdApiKey: process.env.NVD_API_KEY || undefined,
    githubToken: process.env.GITHUB_TOKEN || undefined,
    syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || "60", 10),
    notificationsEnabled: process.env.NOTIFICATIONS_ENABLED !== "false" && process.env.NOTIFICATIONS_ENABLED !== "0",
    notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || undefined,
    dataDir: process.env.INFOCVE_DATA_DIR || "./data",
    adminSecret: process.env.ADMIN_SECRET || undefined,
  };
}
