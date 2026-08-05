import Link from "next/link";
import { getUserProfile, requireAuth } from "@/lib/auth/session";
import { SignOutButton } from "./SignOutButton";

export async function AuthHeader({ adminOnly }: { adminOnly?: boolean } = {}) {
  const profile = adminOnly ? await requireAuth() : await getUserProfile();
  if (!profile) return null;

  return (
    <header className="border-b border-zinc-200 bg-white p-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="font-semibold text-zinc-900">
          Figma Screen Navigator
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>
            {profile.email} · {profile.role.replace("_", " ")}
          </span>
          {profile.role === "design_administrator" && (
            <Link href="/admin/sync" className="text-blue-600 hover:underline">
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
