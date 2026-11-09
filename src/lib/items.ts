import { rows } from "./db";
import { similarIds } from "./vectors";
import type { Item, ManagedItem, Category } from "./types";
export const categories = () =>
  rows<Category>("SELECT * FROM categories ORDER BY category_name");
export const publicItems = () =>
  rows<Item>(
    "SELECT * FROM public_items ORDER BY (status = 'available') DESC, created_at DESC, item_id DESC",
  );
export async function publicItem(id: number) {
  const [item] = await rows<Item>(
    "SELECT * FROM public_items WHERE item_id = ?",
    [id],
  );
  return item;
}
export const managedItems = () =>
  rows<ManagedItem>(`
  SELECT i.*, c.category_name, DATE_FORMAT(i.found_date, '%Y-%m-%d') AS found_date,
         u.full_name AS submitted_by_name, u.college_id AS submitted_by_college_id,
         co.claimant_name, co.claimant_college_id, co.collected_at,
         a.full_name AS handed_over_by_name
  FROM items i JOIN categories c ON c.category_id = i.category_id
  JOIN users u ON u.user_id = i.submitted_by
  LEFT JOIN collections co ON co.item_id = i.item_id
  LEFT JOIN users a ON a.user_id = co.handed_over_by
  ORDER BY FIELD(i.status, 'awaiting_deposit','available','collected'), i.item_id DESC`);
export async function similarItems(id: number) {
  const ids = await similarIds(id);
  if (!ids.length) return [];
  const items = await rows<Item>(
    `SELECT * FROM public_items WHERE status = 'available' AND item_id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  return ids
    .map((id) => items.find((item) => item.item_id === id))
    .filter((i): i is Item => !!i)
    .slice(0, 3);
}
