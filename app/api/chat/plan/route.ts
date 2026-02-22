import { type NextRequest, NextResponse } from "next/server";
import { BOT_ID, ensureMessageIds, toApiMessages } from "@/lib/chat-ids";
import { getCoTPlanningPrompt } from "@/lib/skills/cot-planning";
import { consumeSSEStream } from "@/lib/stream-consumer";

const CHATJIMMY_URL = "https://chatjimmy.ai/api/chat";
const COT_MODEL = "llama3.1-70b";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    const systemPrompt = getCoTPlanningPrompt();
    const apiMessages = toApiMessages(
      ensureMessageIds([{ role: "user", content: message }]),
    );

    const chatJimmyBody = {
      messages: apiMessages,
      chatOptions: {
        selectedModel: COT_MODEL,
        systemPrompt,
        topK: 8,
        temperature: 0.3,
      },
      botId: BOT_ID,
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
      console.error("ChatJimmy plan API error:", response.status, text);
      return NextResponse.json(
        { error: "Failed to generate plan", details: text },
        { status: response.status },
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "No response body" },
        { status: 500 },
      );
    }

    const { text } = await consumeSSEStream(response.body, () => {});

    return NextResponse.json({ plan: text.trim() });
  } catch (error) {
    console.error("Plan API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate plan",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
