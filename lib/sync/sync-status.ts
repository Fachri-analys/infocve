export interface SyncStatusInput {
  sourceId: string;
  success: boolean;
  complete?: boolean;
  warning?: boolean;
}

export type SyncStatus = "completed" | "completed_with_warnings" | "incomplete" | "failed";

export function summarizeSyncStatus(results: SyncStatusInput[]): SyncStatus {
  if (results.length === 0) return "failed";
  if (results.some(({ sourceId, success }) => !success && (sourceId === "NVD" || sourceId === "ALL"))) return "failed";
  if (results.some(({ sourceId, complete }) => sourceId === "NVD" && complete === false)) return "incomplete";
  if (results.some(({ warning }) => warning)) return "completed_with_warnings";
  if (results.some(({ success }) => !success)) return "completed_with_warnings";
  return "completed";
}
