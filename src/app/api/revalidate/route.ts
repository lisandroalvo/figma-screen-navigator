import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/revalidate — bust the navigator data cache after a re-index.
 * Header: `Authorization: Bearer $REVALIDATE_SECRET` (env, server-only).
 * Sync scripts call this at the end so fresh Figma data shows immediately
 * instead of waiting for the 5-minute TTL.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("navigator", "max");
  revalidatePath("/", "layout"); // bust all ISR pages under the root layout
  return NextResponse.json({ revalidated: true, tag: "navigator" });
}
