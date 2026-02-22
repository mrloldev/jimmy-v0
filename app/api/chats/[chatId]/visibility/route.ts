import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(
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

    const { privacy } = await request.json();

    if (
      !(
        privacy &&
        ["public", "private", "team", "team-edit", "unlisted"].includes(privacy)
      )
    ) {
      return NextResponse.json(
        { error: "Invalid privacy setting" },
        { status: 400 },
      );
    }

    return NextResponse.json({ id: chatId, privacy });
  } catch (error) {
    console.error("Change Chat Visibility Error:", error);
    return NextResponse.json(
      {
        error: "Failed to change chat visibility",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
