let lastRequestAt = 0;

/** Process-local spacing; the Neon sync lease prevents concurrent Vercel jobs. */
export async function acquireNvdSyncSlot(hasApiKey = Boolean(process.env.NVD_API_KEY?.trim())): Promise<void> {
  const minGapMs = hasApiKey ? 700 : 6_100;
  const waitMs = Math.max(0, minGapMs - (Date.now() - lastRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}
