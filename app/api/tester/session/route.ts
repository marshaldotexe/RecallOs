import { NextResponse } from "next/server";
import { isSameOrigin, issueTesterSession, SESSION_SECONDS, TESTER_COOKIE } from "@/lib/tester-session";



export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const code = body && typeof body === "object" && "code" in body ? body.code : null;
  const session = issueTesterSession(code);
  if (!session) return Response.json({ error: "Code not accepted or demo access is not configured." }, { status: 401 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(TESTER_COOKIE, session, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: SESSION_SECONDS,
  });
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(TESTER_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: 0,
  });
  return response;
}
