"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { refreshScreenPreviews } from "@/lib/services/previews";

export async function refreshPreviewsForScreen(screenId: string, jobId: string) {
  const { userId } = await requireAdmin();
  const result = await refreshScreenPreviews(screenId);
  // Note: preview service records an audit log; actor is not passed here.
  revalidatePath(`/admin/sync/${jobId}`);
  return { success: true, ...result, actor: userId };
}
