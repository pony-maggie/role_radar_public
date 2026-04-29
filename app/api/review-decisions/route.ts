import { hasValidReviewToken } from "@/lib/review/access";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!hasValidReviewToken(request)) {
    return NextResponse.json({ error: "Review access denied" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Review mutations are disabled. Gemini inference now flows directly into diagnostics and role timelines."
    },
    { status: 410 }
  );
}
