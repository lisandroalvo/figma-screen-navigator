import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { productsTable } from "../../../drizzle/schema";
import type { Product } from "@/types";

function mapProduct(row: typeof productsTable.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listProducts(): Promise<Product[]> {
  const db = getDb();
  const rows = await db.select().from(productsTable);
  return rows.map(mapProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.slug, slug))
    .limit(1);
  return rows[0] ? mapProduct(rows[0]) : null;
}
