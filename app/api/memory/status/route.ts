import { DEVELOPMENT_NAMESPACE, getMemoryStatus } from "@/lib/memwal";
import { logOperation } from "@/lib/server-diagnostics";

export async function GET() {
  const startedAt = Date.now();

  try {
    const { memoryCount } = await getMemoryStatus();
    logOperation("walrus.status", startedAt);

    return Response.json({
      connected: true,
      memoryCount,
      identity: "Development / test identity",
      namespace: DEVELOPMENT_NAMESPACE,
    });
  } catch (error) {
    logOperation("walrus.status", startedAt, error);
    return Response.json({
      connected: false,
      memoryCount: 0,
      identity: "Development / test identity",
    });
  }
}
