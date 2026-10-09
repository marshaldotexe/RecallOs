import "server-only";

import { MemWal, type AnalyzeWaitResult, type RecallMemory } from "@mysten-incubation/memwal";

export type MemorySaveSummary = {
  factCount: number;
  total: number;
  succeeded: number;
  failed: number;
  done: number;
  jobFailed: number;
  timedOut: number;
};

const RECALL_LIMIT = 5;
const RECALL_MAX_DISTANCE = 0.8;
const RECALL_MAX_TOKENS = 1_000;
// analyze() has its own 60s SDK deadline. This budget is only for the
// follow-up remember-job poll. 30s was shorter than typical Walrus
// encrypt/upload/index, so jobs still running were counted as failures.
const SAVE_WAIT_TIMEOUT_MS = 120_000;

export function getMemWal(namespace: string) {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL;

  if (!key || !accountId || !serverUrl) {
    throw new Error("Walrus Memory is not configured.");
  }

  return MemWal.create({
    key,
    accountId,
    serverUrl,
    namespace,
  });
}

export async function recallForChat(query: string, namespace: string): Promise<RecallMemory[]> {
  const memwal = getMemWal(namespace);

  try {
    const result = await memwal.recall({
      query,
      namespace,
      limit: RECALL_LIMIT,
      maxDistance: RECALL_MAX_DISTANCE,
      maxTokens: RECALL_MAX_TOKENS,
    });

    return result.results;
  } finally {
    memwal.destroy();
  }
}

export function summarizeMemorySave(result: AnalyzeWaitResult): MemorySaveSummary {
  let done = 0;
  let jobFailed = 0;
  let timedOut = 0;

  for (const item of result.results) {
    if (item.status === "done") done += 1;
    else if (item.status === "timeout") timedOut += 1;
    else jobFailed += 1;
  }

  return {
    factCount: result.facts.length,
    total: result.total,
    succeeded: result.succeeded,
    failed: result.failed,
    done,
    jobFailed,
    timedOut,
  };
}

export async function saveUsefulFacts(text: string, namespace: string) {
  const memwal = getMemWal(namespace);

  try {
    return await memwal.analyzeAndWait(
      text,
      namespace,
      { timeoutMs: SAVE_WAIT_TIMEOUT_MS },
    );
  } finally {
    memwal.destroy();
  }
}

export async function getMemoryStatus(namespace: string) {
  const memwal = getMemWal(namespace);

  try {
    const health = await memwal.health();
    if (health.status !== "ok" && health.status !== "healthy") {
      throw new Error("Walrus Memory relayer is unavailable.");
    }

    let cursor: string | undefined;
    let memoryCount = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await memwal.listNamespaces({ cursor, limit: 100 });
      const match = page.namespaces.find(
        (entry) => entry.name === namespace,
      );

      if (match) {
        memoryCount = match.memory_count;
        break;
      }

      cursor = page.next_cursor ?? undefined;
      hasMore = page.has_more;
    }

    return { memoryCount };
  } finally {
    memwal.destroy();
  }
}
