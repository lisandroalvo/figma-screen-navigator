import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { profilesTable } from "../../../drizzle/schema";

export type Role = "qa_viewer" | "design_administrator";

export interface UserProfile {
  userId: string;
  email: string;
  role: Role;
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getSession();
  if (!user) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, user.id))
    .limit(1);

  if (rows[0]) {
    return {
      userId: user.id,
      email: rows[0].email,
      role: rows[0].role as Role,
    };
  }

  // No profile yet; bootstrap from ADMIN_EMAILS if it matches.
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const role: Role = adminEmails.includes(user.email?.toLowerCase() ?? "")
    ? "design_administrator"
    : "qa_viewer";

  await db.insert(profilesTable).values({
    userId: user.id,
    email: user.email ?? "",
    role,
  });

  return { userId: user.id, email: user.email ?? "", role };
}

export async function requireAuth(): Promise<UserProfile> {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireAuth();
  if (profile.role !== "design_administrator") {
    throw new Error("Forbidden: administrator role required");
  }
  return profile;
}
