import { type NextRequest, NextResponse } from "next/server";
import { getChatDemo } from "@/lib/db/queries";

export async function GET(
  request: NextRequest,
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

    const demo = await getChatDemo(chatId);
    const origin = request.nextUrl.origin;
    const demoUrl = demo ? `${origin}/u/${chatId}` : undefined;

    return NextResponse.json({
      id: chatId,
      demo: demoUrl,
    });
  } catch (error) {
    console.error("Error fetching chat details:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch chat details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
