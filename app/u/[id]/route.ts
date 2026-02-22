import { type NextRequest, NextResponse } from "next/server";
import { getChatDemo } from "@/lib/db/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await getChatDemo(id);

    if (!row) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(row.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Shared UI route error:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
