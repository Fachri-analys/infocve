export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { SyncEngine } = await import("@/lib/sync/sync-engine");
    SyncEngine.autoSyncIfEmpty().catch(() => {});
  }
}
