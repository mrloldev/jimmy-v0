import { type NextRequest, NextResponse } from "next/server";
import { upsertChatDemo } from "@/lib/db/queries";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chat_id, html } = body;

    if (!chat_id || typeof chat_id !== "string") {
      return NextResponse.json(
        { error: "chat_id is required" },
        { status: 400 },
      );
    }

    if (!html || typeof html !== "string") {
      return NextResponse.json(
        { error: "html is required" },
        { status: 400 },
      );
    }

    const row = await upsertChatDemo(chat_id, html);
    if (!row) {
      return NextResponse.json(
        { error: "Failed to create share" },
        { status: 500 },
      );
    }

    const origin = request.nextUrl.origin;
    const url = `${origin}/u/${row.chat_id}`;

    return NextResponse.json({ chat_id: row.chat_id, url });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500 },
    );
  }
}
