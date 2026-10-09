"use client";

import { useState, type FormEvent } from "react";

export default function TesterPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tester/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        setError("Code not accepted. Ask the demo organizer for your tester code.");
        return;
      }
      window.location.assign("/");
    } catch { setError("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true);
    try {
      const response = await fetch("/api/tester/session", { method: "DELETE" });
      if (response.ok) window.location.assign("/tester");
      else setError("Could not end the session. Please try again.");
    } catch { setError("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <main className="min-h-screen bg-[#0b0d12] text-white flex items-center justify-center p-6">
      <section className="w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold">RecallOS demo tester</h1>
        <p>Enter your assigned code to use your separate demo memory space.</p>
        <p className="text-sm text-gray-400">This is demo identity selection, not production sign-in. Anyone with your code can use your demo space. Use fictional facts only.</p>
        <form onSubmit={enter} className="space-y-4">
          <label className="block">Tester code
            <input type="password" autoComplete="off" required maxLength={256}
              value={code} onChange={(event) => setCode(event.target.value)}
              className="mt-2 block w-full rounded border border-gray-600 bg-transparent p-3" />
          </label>
          <button disabled={busy} className="rounded bg-violet-600 px-4 py-3 disabled:opacity-50">{busy ? "Please wait…" : "Enter demo"}</button>
        </form>
        <button onClick={leave} disabled={busy} className="text-sm underline">End current demo session</button>
        <p className="text-sm text-gray-400">Use a separate browser profile for each tester. Close other RecallOS tabs before switching testers.</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}
      </section>
    </main>
  );
}
