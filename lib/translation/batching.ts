export interface TranslationJob {
  source_hash: string;
  source_text: string;
  attempts: number;
}

export interface TranslationGroup {
  jobs: TranslationJob[];
  charCount: number;
}

const MAX_TEXTS_PER_REQUEST = 32;
const MAX_CHARS_PER_REQUEST = 60_000;

export function groupTranslationJobs(jobs: TranslationJob[]): TranslationGroup[] {
  const groups: TranslationGroup[] = [];
  let current: TranslationGroup = { jobs: [], charCount: 0 };
  for (const job of jobs) {
    const textLength = job.source_text.length;
    if (textLength > 20_000) {
      groups.push({ jobs: [job], charCount: textLength });
      continue;
    }
    if (current.jobs.length > 0 && (current.jobs.length >= MAX_TEXTS_PER_REQUEST || current.charCount + textLength > MAX_CHARS_PER_REQUEST)) {
      groups.push(current);
      current = { jobs: [], charCount: 0 };
    }
    current.jobs.push(job);
    current.charCount += textLength;
  }
  if (current.jobs.length > 0) groups.push(current);
  return groups;
}

export function getSafeTranslationGroupLimit(options: {
  workBudgetMs: number;
  databaseReserveMs: number;
  concurrency: number;
  timeoutMs: number;
  attempts: number;
  retryDelayMs: number;
}): number {
  const attempts = Math.max(1, options.attempts);
  const retryDelayMs = Math.max(0, options.retryDelayMs);
  const worstRetryDelayMs = retryDelayMs * (2 ** (attempts - 1) - 1);
  const worstRequestMs = attempts * Math.max(1, options.timeoutMs) + worstRetryDelayMs;
  const availableMs = Math.max(0, options.workBudgetMs - Math.max(0, options.databaseReserveMs));
  return Math.floor(availableMs / worstRequestMs) * Math.max(1, options.concurrency);
}
