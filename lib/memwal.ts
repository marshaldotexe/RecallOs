import "server-only";

import { MemWal, type RecallMemory } from "@mysten-incubation/memwal";

export const DEVELOPMENT_NAMESPACE = "recallos-development";

const RECALL_LIMIT = 5;
const RECALL_MAX_DISTANCE = 0.8;
const RECALL_MAX_TOKENS = 1_000;

export function getMemWal() {
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
    namespace: DEVELOPMENT_NAMESPACE,
  });
}

export async function recallForChat(query: string): Promise<RecallMemory[]> {
  const memwal = getMemWal();

  try {
    const result = await memwal.recall({
      query,
      namespace: DEVELOPMENT_NAMESPACE,
      limit: RECALL_LIMIT,
      maxDistance: RECALL_MAX_DISTANCE,
      maxTokens: RECALL_MAX_TOKENS,
    });

    return result.results;
  } finally {
    memwal.destroy();
  }
}

export async function saveUsefulFacts(text: string) {
  const memwal = getMemWal();

  try {
    return await memwal.analyzeAndWait(
      text,
      DEVELOPMENT_NAMESPACE,
      { timeoutMs: 30_000 },
    );
  } finally {
    memwal.destroy();
  }
}

export async function getMemoryStatus() {
  const memwal = getMemWal();

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
      const namespace = page.namespaces.find(
        (entry) => entry.name === DEVELOPMENT_NAMESPACE,
      );

      if (namespace) {
        memoryCount = namespace.memory_count;
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
