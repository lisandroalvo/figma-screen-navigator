import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { profilesTable } from "../drizzle/schema";
import { getServerEnv } from "@/lib/env";

dotenv.config({ path: ".env.local", override: true });

function generatePassword(): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 20;
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

async function main() {
  const env = getServerEnv();
  const adminEmail = env.ADMIN_EMAILS;

  if (!adminEmail) {
    throw new Error(
      "ADMIN_EMAILS is not set in .env.local. Add it and try again.",
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = list?.users.find(
    (u) => u.email?.toLowerCase() === adminEmail.toLowerCase(),
  );

  const explicitPassword = process.argv[2];
  const password = explicitPassword ?? generatePassword();
  let userId: string | undefined;

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
      },
    );
    if (error) throw error;
    userId = data.user.id;
    console.log("Existing user updated with a new password.");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user?.id;
    console.log("New user created with a new password.");
  }

  if (!userId) throw new Error("Could not obtain user ID after upsert.");

  const db = getDb();
  await db
    .insert(profilesTable)
    .values({
      userId,
      email: adminEmail.toLowerCase(),
      role: "design_administrator",
    })
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: { role: "design_administrator" },
    });

  console.log(`Profile set to design_administrator.`);

  if (!explicitPassword) {
    const path = "/tmp/.figma-admin-password";
    fs.writeFileSync(path, `${password}`, { mode: 0o600 });
    console.log(`Temporary password written to ${path}`);
    console.log(
      `Read it with: cat ${path}  (delete the file immediately after signing in)`,
    );
  }

  console.log("User ID:", userId);
}

main().catch((err) => {
  console.error("Admin user setup failed:", err);
  process.exit(1);
});
