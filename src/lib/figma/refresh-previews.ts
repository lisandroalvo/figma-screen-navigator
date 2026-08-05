import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { refreshAllPublishedPreviews } from "@/lib/services/previews";

async function main() {
  const result = await refreshAllPublishedPreviews();
  console.log("Preview refresh result:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Preview refresh failed:", err);
  process.exit(1);
});
