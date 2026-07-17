import { Message, StreamEvent, AgentType } from "@/types";
import { generateId } from "@/lib/utils";

// API_BASE comes from env only — never from user input (CWE-918)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Client-side input limits (mirrors backend security.py)
const MAX_CONTENT_LENGTH = 4000;

function truncateContent(content: string): string {
  return content.slice(0, MAX_CONTENT_LENGTH);
}

export async function streamChat(
  messages: Message[],
  onToken: (token: string) => void,
  onAgent: (agent: AgentType, queryType: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const payload = {
    messages: messages.map((m) => ({
      role: m.role,
      content: truncateContent(m.content),
      ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    })),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    onError("Cannot connect to backend. Is it running on port 8000?");
    return;
  }

  if (!res.ok) {
    onError(`Server error: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) { onError("No response body"); return; }

  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          if (event.type === "agent") onAgent(event.agent!, event.query_type ?? "");
          else if (event.type === "token") onToken(event.content ?? "");
          else if (event.type === "done") onDone();
          else if (event.type === "error") onError(event.message ?? "Unknown error");
        } catch { /* malformed SSE line — skip */ }
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw e;
  } finally {
    reader.releaseLock();
  }
}

export function createUserMessage(content: string): Message {
  return { id: generateId(), role: "user", content, timestamp: new Date() };
}

export function createAssistantPlaceholder(): Message {
  return { id: generateId(), role: "assistant", content: "", timestamp: new Date(), isStreaming: true };
}
