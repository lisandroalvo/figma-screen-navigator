import { redirect } from "next/navigation";

// Modules list merged into the Navigator home; keep the URL as an alias.
export default function ModulesPage() {
  redirect("/");
}
