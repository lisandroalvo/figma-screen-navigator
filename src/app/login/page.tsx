import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getUserProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getUserProfile();
  if (profile) {
    redirect(profile.role === "design_administrator" ? "/admin/sync" : "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Figma Screen Navigator</h1>
        <p className="text-sm text-zinc-600">Internal tool — sign in with your email.</p>
        <LoginForm />
      </div>
    </main>
  );
}
