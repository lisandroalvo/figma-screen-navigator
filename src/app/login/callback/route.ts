import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink" | "email",
      });
      if (error) throw error;
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "auth-callback-failed";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
