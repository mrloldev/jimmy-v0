export const BOT_ID = process.env.CHATJIMMY_BOT_ID ?? "default";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

export function ensureMessageIds(
  messages: Array<{ id?: string; role: string; content: string }>,
): ChatMessage[] {
  return messages.map((msg, i) => ({
    ...msg,
    id: msg.id ?? `msg-${i}-${Date.now()}`,
    role: msg.role as "user" | "assistant",
  }));
}

export function toApiMessages(
  messages: ChatMessage[],
): Array<{ id: string; role: string; content: string }> {
  return messages.map((m) => ({
    id: m.id ?? `msg-${Date.now()}`,
    role: m.role,
    content: m.content,
  }));
}
