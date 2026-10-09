import { getMemoryStatus } from "@/lib/memwal";
import { getTesterIdentity, testerRequired } from "@/lib/tester-session";
import { logOperation } from "@/lib/server-diagnostics";



export async function GET() {
  const identity = await getTesterIdentity();
  if (!identity) return testerRequired();
  const headers = { "Cache-Control": "private, no-store" };
  const startedAt = Date.now();

  try {
    const { memoryCount } = await getMemoryStatus(identity.namespace);
    logOperation("walrus.status", startedAt);

    return Response.json({
      connected: true,
      memoryCount,
      identity: identity.label,
      testerId: identity.id,
    }, { headers });
  } catch (error) {
    logOperation("walrus.status", startedAt, error);
    return Response.json({
      connected: false,
      memoryCount: 0,
      identity: identity.label,
      testerId: identity.id,
    }, { headers });
  }
}
