import { type NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({ data: [] });
  } catch (error) {
    console.error("Chats fetch error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch chats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
