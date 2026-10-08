import { saveUsefulFacts } from "@/lib/memwal";
import { logOperation } from "@/lib/server-diagnostics";

const MAX_TEXT_LENGTH = 4_000;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const text = body && typeof body === "object" && "text" in body
    ? (body as { text?: unknown }).text
    : null;

  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return Response.json({ error: "A valid message is required." }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const result = await saveUsefulFacts(text.trim());

    if (result.failed > 0) {
      logOperation("walrus.save", startedAt, {
        code: "PARTIAL_FAILURE",
        status: 502,
      });
      return Response.json(
        { saved: false, error: "Some memories could not be saved." },
        { status: 502 },
      );
    }

    logOperation("walrus.save", startedAt);
    return Response.json({ saved: true, savedCount: result.succeeded });
  } catch (error) {
    logOperation("walrus.save", startedAt, error);
    return Response.json(
      { saved: false, error: "Memory saving failed." },
      { status: 502 },
    );
  }
}
