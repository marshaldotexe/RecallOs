import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const TESTER_COOKIE = "recallos_demo_session";
export const SESSION_SECONDS = 60 * 60 * 24;

// These are application identities, never Walrus account IDs.
const testers = {
  alice: { label: "Tester Alice", namespace: "recallos-demo-v1-alice" },
  bob: { label: "Tester Bob", namespace: "recallos-demo-v1-bob" },
  charlie: { label: "Tester Charlie", namespace: "recallos-demo-v1-charlie" },
} as const;
type TesterId = keyof typeof testers;

function settings() {
  if (process.env.RECALLOS_DEMO_ENABLED !== "true") return null;
  const secret = process.env.RECALLOS_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  try {
    const codes: unknown = JSON.parse(process.env.RECALLOS_TESTER_CODES ?? "{}");
    if (!codes || typeof codes !== "object" || Array.isArray(codes)) return null;
    const entries = Object.entries(codes);
    if (!entries.length || entries.some(([id, code]) =>
      !Object.hasOwn(testers, id) || typeof code !== "string" || code.length < 32
    )) return null;
    if (new Set(entries.map(([, code]) => code)).size !== entries.length) return null;
    return { secret, codes: codes as Partial<Record<TesterId, string>> };
  } catch {
    return null;
  }
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function issueTesterSession(code: unknown) {
  const config = settings();
  if (!config || typeof code !== "string" || code.length > 256) return null;
  const id = (Object.keys(config.codes) as TesterId[]).find((id) =>
    timingSafeEqual(digest(code), digest(config.codes[id]!))
  );
  if (!id) return null;
  const payload = `${id}.${Math.floor(Date.now() / 1000) + SESSION_SECONDS}`;
  // Binding to the code invalidates existing sessions when that code is rotated.
  const signature = createHmac("sha256", config.secret)
    .update(`${payload}.${config.codes[id]}`).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyTesterSession(token: string | undefined) {
  const config = settings();
  if (!config || !token || token.length > 256) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expiry, signature] = parts;
  if (!Object.hasOwn(testers, id) || !/^\d{10}$/.test(expiry) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const testerId = id as TesterId;
  const code = config.codes[testerId];
  const now = Math.floor(Date.now() / 1000);
  if (!code || Number(expiry) <= now || Number(expiry) > now + SESSION_SECONDS) return null;
  const expected = createHmac("sha256", config.secret)
    .update(`${id}.${expiry}.${code}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  return { id: testerId, ...testers[testerId] };
}

export async function getTesterIdentity() {
  return verifyTesterSession((await cookies()).get(TESTER_COOKIE)?.value);
}

export function isSameOrigin(request: Request) {
  // Browsers send Origin on the app's POST/DELETE requests. Fail closed.
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function testerRequired() {
  return Response.json({ error: "Enter your demo tester code at /tester first." },
    { status: 401, headers: { "Cache-Control": "no-store" } });
}
