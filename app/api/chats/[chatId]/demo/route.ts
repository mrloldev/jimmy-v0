import { type NextRequest, NextResponse } from "next/server";
import { upsertChatDemo } from "@/lib/db/queries";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params;
    const body = await request.json();
    const { html } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 },
      );
    }

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "HTML is required" }, { status: 400 });
    }

    const row = await upsertChatDemo(chatId, html);
    if (!row) {
      return NextResponse.json(
        { error: "Failed to save demo" },
        { status: 500 },
      );
    }

    const origin = request.nextUrl.origin;
    const demoUrl = `${origin}/u/${chatId}`;

    return NextResponse.json({ demo: demoUrl });
  } catch (error) {
    console.error("Error saving chat demo:", error);
    return NextResponse.json(
      {
        error: "Failed to save demo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
