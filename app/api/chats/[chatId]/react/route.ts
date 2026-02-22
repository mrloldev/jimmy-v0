import { type NextRequest, NextResponse } from "next/server";
import { upsertChatDemo } from "@/lib/db/queries";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params;
    const body = await request.json();
    const { reactCode } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 },
      );
    }

    if (!reactCode || typeof reactCode !== "string") {
      return NextResponse.json(
        { error: "React code is required" },
        { status: 400 },
      );
    }

    const row = await upsertChatDemo(chatId, reactCode);
    if (!row) {
      return NextResponse.json(
        { error: "Failed to save React code" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving React code:", error);
    return NextResponse.json(
      {
        error: "Failed to save React code",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params;

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 },
      );
    }

    const { getChatDemo } = await import("@/lib/db/queries");
    const demo = await getChatDemo(chatId);

    if (!demo) {
      return NextResponse.json(
        { error: "React code not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ reactCode: demo.html });
  } catch (error) {
    console.error("Error fetching React code:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch React code",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
