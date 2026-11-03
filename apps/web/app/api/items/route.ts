import { NextResponse, type NextRequest } from "next/server";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 100);

  let cursor;
  const raw = params.get("cursor");
  if (raw) {
    try {
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      cursor = { publishedAt: new Date(parsed.p), id: Number(parsed.i) };
      if (Number.isNaN(cursor.publishedAt.getTime()) || !Number.isInteger(cursor.id)) throw 0;
    } catch {
      return NextResponse.json(
        { error: "Invalid cursor. Use the nextCursor value from a previous response." },
        { status: 400 },
      );
    }
  }

  const { items, nextCursor } = await getFeed(limit, cursor);
  return NextResponse.json({
    items,
    nextCursor: nextCursor
      ? Buffer.from(JSON.stringify({ p: nextCursor.publishedAt.toISOString(), i: nextCursor.id })).toString("base64url")
      : null,
  });
}