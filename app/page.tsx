"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type RetrievedMemory = {
  text: string;
  distance: number;
};

type MemoryState = {
  connected: boolean;
  checking: boolean;
  memoryCount: number;
  retrieved: RetrievedMemory[];
};

const MAX_MESSAGE_LENGTH = 4_000;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const navigation = [
  {
    label: "Projects",
    icon: (
      <Icon>
        <path d="M3.8 7.5h6l1.7 2h8.7v8.8a1.7 1.7 0 0 1-1.7 1.7h-13a1.7 1.7 0 0 1-1.7-1.7V7.5Z" />
        <path d="M3.8 7.5V5.7A1.7 1.7 0 0 1 5.5 4h3.2l1.7 2h4" />
      </Icon>
    ),
  },
  {
    label: "Code",
    icon: (
      <Icon>
        <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5l-3 14" />
      </Icon>
    ),
  },
  {
    label: "Learning",
    icon: (
      <Icon>
        <path d="m3 10 9-5 9 5-9 5-9-5Z" />
        <path d="M7 12.2v4.3c2.8 2 7.2 2 10 0v-4.3M21 10v6" />
      </Icon>
    ),
  },
];

export default function Home() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMemorySaving, setIsMemorySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryWarning, setMemoryWarning] = useState<string | null>(null);
  const [memoryState, setMemoryState] = useState<MemoryState>({
    connected: false,
    checking: true,
    memoryCount: 0,
    retrieved: [],
  });
  const inFlight = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const conversationEpoch = useRef(0);

  const refreshMemoryStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/memory/status", { cache: "no-store" });
      const data: unknown = await response.json();
      const connected =
        response.ok && data !== null && typeof data === "object" &&
        "connected" in data && data.connected === true;
      const memoryCount =
        data !== null && typeof data === "object" &&
        "memoryCount" in data && typeof data.memoryCount === "number"
          ? data.memoryCount
          : 0;

      setMemoryState((current) => ({
        ...current,
        connected,
        checking: false,
        memoryCount: connected ? memoryCount : 0,
      }));
    } catch {
      setMemoryState((current) => ({
        ...current,
        connected: false,
        checking: false,
        memoryCount: 0,
      }));
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshMemoryStatus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshMemoryStatus]);

  async function persistMemory(text: string, epoch: number) {
    setIsMemorySaving(true);

    try {
      const response = await fetch("/api/memory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const saveError =
          data && typeof data === "object" && "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Memory saving failed.";
        throw new Error(saveError);
      }

      if (conversationEpoch.current === epoch) {
        await refreshMemoryStatus();
      }
    } catch (saveError) {
      if (conversationEpoch.current === epoch) {
        setMemoryWarning(
          saveError instanceof Error ? saveError.message : "Memory saving failed.",
        );
      }
    } finally {
      if (conversationEpoch.current === epoch) {
        setIsMemorySaving(false);
      }
    }
  }

  async function sendConversation(conversation: Message[]) {
    if (inFlight.current) return;

    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    setMemoryWarning(null);
    const controller = new AbortController();
    abortController.current = controller;
    const epoch = conversationEpoch.current;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.slice(-20).map(({ role, content }) => ({
            role,
            content,
          })),
        }),
        signal: controller.signal,
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const serverError =
          data && typeof data === "object" && "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "The request failed. Please try again.";
        throw new Error(serverError);
      }

      const responseMessage =
        data && typeof data === "object" && "message" in data &&
        typeof data.message === "string"
          ? data.message.trim()
          : "";

      if (!responseMessage) {
        throw new Error("RecallOS returned an invalid response. Please try again.");
      }

      const memoryPayload =
        data && typeof data === "object" && "memory" in data &&
        data.memory && typeof data.memory === "object"
          ? data.memory as Record<string, unknown>
          : null;
      const retrieved = memoryPayload && Array.isArray(memoryPayload.retrieved)
        ? memoryPayload.retrieved.filter((item): item is RetrievedMemory => (
            item !== null && typeof item === "object" &&
            "text" in item && typeof item.text === "string" &&
            "distance" in item && typeof item.distance === "number"
          ))
        : [];
      const warning = memoryPayload && typeof memoryPayload.warning === "string"
        ? memoryPayload.warning
        : null;
      const saveRecommended = memoryPayload?.saveRecommended === true;

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: responseMessage },
      ]);
      setMemoryState((current) => ({ ...current, retrieved }));
      setMemoryWarning(warning);
      void refreshMemoryStatus();

      if (saveRecommended) {
        abortController.current = null;
        inFlight.current = false;
        setIsLoading(false);
        await persistMemory(conversation.at(-1)!.content, epoch);
      }
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach RecallOS. Please try again.",
      );
    } finally {
      if (abortController.current === controller) {
        abortController.current = null;
        inFlight.current = false;
        setIsLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();

    if (!content || inFlight.current) return;

    const nextMessages: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content },
    ];
    setMessages(nextMessages);
    setDraft("");
    void sendConversation(nextMessages);
  }

  function startNewChat() {
    conversationEpoch.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    inFlight.current = false;
    setIsLoading(false);
    setIsMemorySaving(false);
    setError(null);
    setMemoryWarning(null);
    setMemoryState((current) => ({ ...current, retrieved: [] }));
    setDraft("");
    setMessages([]);
  }

  return (
    <main className="flex h-dvh min-h-[640px] overflow-hidden bg-[#080b10] text-[#e8eaed]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#0b0f15] p-4 md:flex">
        <div className="flex h-12 items-center gap-3 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#8b7cf6] text-[#0b0d12] shadow-[0_0_24px_rgba(139,124,246,0.25)]">
            <Icon>
              <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3.1A2.5 2.5 0 0 1 5 13.5v-6Z" />
              <path d="M9 9.5h6M9 12.5h4" />
            </Icon>
          </div>
          <div>
            <p className="font-semibold tracking-tight text-white">RecallOS</p>
            <p className="text-[11px] text-[#777e8b]">Your context, continued.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8b7cf6] text-sm font-semibold text-[#0d0e14] transition hover:bg-[#9a8df8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a89df9]"
        >
          <Icon><path d="M12 5v14M5 12h14" /></Icon>
          New chat
        </button>

        <nav aria-label="Workspace" className="mt-8">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#656c78]">Workspace</p>
          <div className="mt-3 space-y-1">
            {navigation.map((item, index) => (
              <button
                key={item.label}
                type="button"
                className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition ${index === 0 ? "bg-white/[0.06] text-[#f0f1f3]" : "text-[#8d94a1] hover:bg-white/[0.04] hover:text-[#d8dbe0]"}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#a9afb9]">
            <span className="h-2 w-2 rounded-full bg-[#555b66]" />
            RecallOS Online · {memoryState.connected ? "Memory online" : "Memory offline"}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#666d79]">
            {memoryState.connected ? "Walrus Memory is connected for the development identity." : "RecallOS chat is ready. Persistent memory is unavailable."}
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_0%,rgba(118,99,205,0.08),transparent_34%)]">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#8b7cf6] text-[#0b0d12] md:hidden">
              <Icon><path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3.1A2.5 2.5 0 0 1 5 13.5v-6Z" /></Icon>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#e9ebee]">New conversation</h1>
              <p className="text-xs text-[#656c77]">Pick up where you left off.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-md border border-white/[0.09] px-3 py-2 text-xs font-medium text-[#aeb3bc] transition hover:bg-white/[0.05] hover:text-white md:hidden"
          >
            New chat
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] text-[#7d8490] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" /> RecallOS Online
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] px-4 py-2 md:hidden">
          {navigation.map((item) => (
            <button key={item.label} type="button" className="flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs text-[#8f96a1] hover:bg-white/[0.05]">
              {item.icon}{item.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-8">
            {messages.length === 0 ? (
              <div className="my-auto flex flex-col items-center py-10 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#8b7cf6]/20 bg-[#8b7cf6]/10 text-[#a99df8] shadow-[0_0_50px_rgba(116,94,219,0.12)]">
                  <Icon><path d="M12 3a7 7 0 0 0-4 12.74V20l4-2 4 2v-4.26A7 7 0 0 0 12 3Z" /><path d="M9.5 10.5h5M12 8v5" /></Icon>
                </div>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-[#f0f1f3]">What are you working on?</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#777f8d]">Start a conversation about a project, a stubborn bug, or something you&apos;re learning.</p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/10 bg-amber-300/[0.04] px-3 py-1.5 text-[11px] text-[#9b9177]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300/50" />
                  RecallOS is ready · {memoryState.connected ? "Memory connected" : "Memory is not connected"}
                </div>
              </div>
            ) : (
              <div className="space-y-6" aria-live="polite">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg shadow-black/10 sm:max-w-[75%] ${message.role === "user" ? "rounded-br-md bg-[#8b7cf6] text-[#11121a]" : "rounded-bl-md border border-white/[0.08] bg-[#11161e] text-[#dfe2e7]"}`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#777f8d]" role="status">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8b7cf6]" />
                    RecallOS is thinking…
                  </div>
                )}
                {isMemorySaving && (
                  <div className="flex items-center gap-2 text-xs text-[#777f8d]" role="status">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/70" />
                    Walrus is saving memory…
                  </div>
                )}
                {error && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-red-400/15 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-200/80" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => void sendConversation(messages)} className="shrink-0 rounded-md border border-red-300/20 px-2.5 py-1.5 font-medium text-red-100 transition hover:bg-red-300/10">
                      Retry
                    </button>
                  </div>
                )}
                {memoryWarning && (
                  <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2.5 text-xs text-amber-100/70" role="status">
                    {memoryWarning}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 pb-4 sm:px-8 sm:pb-6">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-xl border border-white/[0.1] bg-[#11161e] p-2 shadow-[0_12px_50px_rgba(0,0,0,0.25)] focus-within:border-[#8b7cf6]/50">
                <label htmlFor="message" className="sr-only">Message RecallOS</label>
                <textarea
                  id="message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={isLoading}
                  placeholder="Ask about your work..."
                  className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-[#e8eaed] outline-none placeholder:text-[#59616d] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isLoading}
                  aria-label="Send message"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#8b7cf6] text-[#101117] transition hover:bg-[#9b8ff8] disabled:cursor-not-allowed disabled:bg-[#292e38] disabled:text-[#5e6570]"
                >
                  <Icon><path d="m5 12 14-7-4.5 14-3-5.5L5 12Z" /><path d="m11.5 13.5 3-3" /></Icon>
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-[#565d68]">
                Messages are sent securely through RecallOS. {memoryState.connected ? "Walrus Memory is active for the development identity." : "Memory is unavailable."}
              </p>
            </form>
          </div>
        </div>
      </section>

      <aside className="hidden w-72 shrink-0 flex-col border-l border-white/[0.07] bg-[#0b0f15] p-5 xl:flex">
        <div className="flex h-8 items-center justify-between">
          <h2 className="text-sm font-semibold text-[#dfe1e5]">Memory</h2>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[10px] text-[#727985]">
            {memoryState.memoryCount} {memoryState.memoryCount === 1 ? "memory" : "memories"}
          </span>
        </div>
        <div className="mt-5 rounded-xl border border-white/[0.07] bg-[#0e131a] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-[#69717d]">
              <Icon><path d="M7 8.5A5 5 0 0 1 17 9v2a3 3 0 0 1 0 6H7a3 3 0 0 1 0-6V8.5Z" /><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0V11" /></Icon>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#aab0ba]">
                {memoryState.checking ? "Checking Memory" : memoryState.connected ? "Memory Online" : "Memory Offline"}
              </p>
              <p className="mt-0.5 text-[10px] text-[#5f6671]">
                {memoryState.connected ? "Powered by Walrus" : "Walrus is not connected"}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-dashed border-white/[0.1] text-[#4f5661]">
            <Icon><path d="M8 12h8M12 8v8" /></Icon>
          </div>
          <p className="mt-3 text-xs font-medium text-[#7c838f]">
            {memoryState.connected ? "Development / test identity" : "No memories available"}
          </p>
          {memoryState.retrieved.length > 0 ? (
            <div className="mt-3 space-y-2 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#606875]">Recalled this turn</p>
              {memoryState.retrieved.map((memory, index) => (
                <p key={`${memory.text}-${index}`} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5 text-[11px] leading-4 text-[#777f8d]">
                  {memory.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="mx-auto mt-1.5 max-w-[190px] text-[11px] leading-5 text-[#555c67]">
              {memoryState.connected ? "Relevant recalled context will appear here during chat." : "Saved context will appear here once memory is connected."}
            </p>
          )}
        </div>
      </aside>
    </main>
  );
}
