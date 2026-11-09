import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const SIZE = 128;
// Feature hashing: same words always enter the same numeric bucket. No AI model.
export function itemVector(input: string): number[] {
  const result = Array<number>(SIZE).fill(0);
  const words = input.toLowerCase().match(/[a-z0-9]+/g) || [];
  const ignored = new Set([
    "a",
    "an",
    "the",
    "in",
    "on",
    "at",
    "and",
    "with",
    "of",
    "is",
    "was",
    "found",
  ]);
  for (const word of words) {
    if (ignored.has(word)) continue;
    let hash = 2166136261;
    for (const ch of word) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    result[(hash >>> 0) % SIZE] += 1;
  }
  // Ensure cosine distance is defined even for empty/unusual descriptions.
  if (!result.some((n) => n !== 0)) result[0] += 1;
  return result;
}
const state = globalThis as unknown as { campusVectors?: Promise<PGlite> };
export async function vectorDb() {
  if (!state.campusVectors) {
    state.campusVectors = (async () => {
      const directory = path.resolve(
        process.env.VECTOR_DATA_DIR || "storage/vectors",
      );
      await mkdir(directory, { recursive: true });
      const db = await PGlite.create(directory, { extensions: { vector } });
      await db.exec(
        "CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE IF NOT EXISTS item_vectors (item_id INTEGER PRIMARY KEY, embedding vector(128) NOT NULL)",
      );
      return db;
    })().catch((error) => {
      state.campusVectors = undefined;
      throw error;
    });
  }
  return state.campusVectors;
}
export async function saveVector(itemId: number, description: string) {
  const values = `[${itemVector(description).join(",")}]`;
  await (
    await vectorDb()
  ).query(
    "INSERT INTO item_vectors(item_id, embedding) VALUES ($1, $2::vector) ON CONFLICT(item_id) DO UPDATE SET embedding = EXCLUDED.embedding",
    [itemId, values],
  );
}
export async function similarIds(itemId: number): Promise<number[]> {
  const db = await vectorDb();
  const result = await db.query<{ item_id: number }>(
    `
    SELECT item_id FROM item_vectors
    WHERE item_id <> $1 AND EXISTS (SELECT 1 FROM item_vectors WHERE item_id = $1)
    ORDER BY embedding <=> (SELECT embedding FROM item_vectors WHERE item_id = $1)
    LIMIT 20`,
    [itemId],
  );
  return result.rows.map((row) => row.item_id);
}
