export async function register() {
  // Vercel functions do not share a writable SQLite file between instances.
  // CVE pages use NVD + the persistent Neon sample cache in production.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { SyncEngine } = await import("@/lib/sync/sync-engine");
    SyncEngine.autoSyncIfEmpty().catch(() => {});
  }
}
