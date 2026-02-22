import { type NextRequest, NextResponse } from "next/server";
import { BOT_ID, ensureMessageIds, toApiMessages } from "@/lib/chat-ids";
import { getSystemPrompt } from "@/lib/skills/frontend-design";

const CHATJIMMY_URL = "https://chatjimmy.ai/api/chat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      message,
      chatId,
      streaming,
      attachments,
      botId,
      model = "llama3.1-70b",
      plan,
    } = body;

    const validModels = ["llama3.1-8b", "llama3.1-70b"];
    const selectedModel = validModels.includes(model) ? model : "llama3.1-70b";

    const isLegacyFormat = !Array.isArray(messages) && typeof message === "string";
    let apiMessages = isLegacyFormat
      ? toApiMessages(
          ensureMessageIds([{ role: "user", content: message as string }]),
        )
      : toApiMessages(ensureMessageIds(messages ?? []));

    if (plan && typeof plan === "string" && plan.trim()) {
      const lastIdx = apiMessages.length - 1;
      const last = apiMessages[lastIdx];
      if (last?.role === "user") {
        const enhanced = `[PLAN]\n${plan.trim()}\n[/PLAN]\n\nOriginal request: ${last.content}`;
        apiMessages = [...apiMessages];
        apiMessages[lastIdx] = { ...last, content: enhanced };
      }
    }

    if (!isLegacyFormat && botId !== BOT_ID) {
      return NextResponse.json(
        { error: "Invalid or missing bot id" },
        { status: 400 },
      );
    }

    if (apiMessages.length === 0) {
      return NextResponse.json(
        { error: "message or messages is required" },
        { status: 400 },
      );
    }

    const systemPrompt = getSystemPrompt();

    const chatJimmyBody = {
      messages: apiMessages,
      ...(chatId && { chatId }),
      chatOptions: {
        selectedModel,
        systemPrompt,
        topK: 8,
        temperature: 0.3,
      },
      attachment: attachments?.[0] ?? null,
      ...(isLegacyFormat && { botId: BOT_ID }),
    };

    const response = await fetch(CHATJIMMY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        Origin: request.nextUrl.origin,
        Referer: request.nextUrl.origin + "/",
        "User-Agent":
          request.headers.get("user-agent") ??
          "Mozilla/5.0 (compatible; Jimmy/1.0)",
      },
      body: JSON.stringify(chatJimmyBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("ChatJimmy API error:", response.status, text);
      return NextResponse.json(
        { error: "Failed to process request", details: text },
        { status: response.status },
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "No response body" },
        { status: 500 },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
