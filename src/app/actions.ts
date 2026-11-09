"use server";

import { redirect } from "next/navigation";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  requireUser,
  requireAdmin,
  createSession,
  destroySession,
} from "@/lib/auth";
import { rows, execute } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  collegeId,
  text,
  positiveId,
  foundDate,
  photoExtension,
  InputError,
} from "@/lib/validation";
import { saveVector } from "@/lib/vectors";
import { redis } from "@/lib/redis";

function message(error: unknown) {
  if (error instanceof InputError) return error.message;
  const code = (error as { code?: string }).code;
  if (code === "ER_DUP_ENTRY")
    return "That college ID or collection already exists.";
  if (code === "ER_SIGNAL_EXCEPTION")
    return "This item is not available for collection. Refresh the page.";
  console.error(
    "Action failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return "Could not save. Check that the local database services are running.";
}
function go(location: string, kind: "error" | "success", value: string): never {
  redirect(`${location}?${kind}=${encodeURIComponent(value)}`);
}

export async function login(form: FormData) {
  let error: string | undefined;
  try {
    const id = collegeId(form);
    const password = text(form, "password", 128);
    const cache = await redis();
    const attempts = await cache.incr(`campus:login:${id}`);
    if (attempts === 1) await cache.expire(`campus:login:${id}`, 60);
    if (attempts > 10)
      throw new InputError("Too many attempts. Try again in one minute.");
    const [user] = await rows<{ user_id: number; password_hash: string }>(
      "SELECT user_id, password_hash FROM users WHERE college_id = ?",
      [id],
    );
    if (!user || !verifyPassword(password, user.password_hash))
      throw new InputError("Incorrect college ID or password.");
    await createSession(user.user_id);
    await cache.del(`campus:login:${id}`);
  } catch (e) {
    error = message(e);
  }
  if (error) go("/login", "error", error);
  redirect("/items");
}
export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function submitItem(form: FormData) {
  const user = await requireUser();
  let error: string | undefined;
  let warning = false;
  let photo: string | undefined;
  let saved = false;
  try {
    const name = text(form, "item_name", 100);
    const category = positiveId(form, "category_id");
    const description = text(form, "description", 1500);
    const color = text(form, "color", 50);
    const brand = text(form, "brand", 80, true);
    const location = text(form, "found_location", 200);
    const date = foundDate(form);
    const [categoryRow] = await rows<{ category_name: string }>(
      "SELECT category_name FROM categories WHERE category_id = ?",
      [category],
    );
    if (!categoryRow) throw new InputError("Choose an existing category.");
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new InputError("Add a photo smaller than 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    photo = `${randomUUID()}.${photoExtension(bytes)}`;
    const directory = path.resolve("storage/photos");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, photo), bytes);
    const result = await execute(
      `INSERT INTO items
      (category_id, item_name, description, color, brand, photo_path, found_location, found_date, submitted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category,
        name,
        description,
        color,
        brand,
        photo,
        location,
        date,
        user.user_id,
      ],
    );
    saved = true;
    // MySQL remains authoritative. A vector failure must not lose the submission.
    try {
      await saveVector(
        result.insertId,
        `${categoryRow.category_name} ${name} ${color} ${brand} ${description}`,
      );
    } catch (e) {
      warning = true;
      console.error(
        "Vector indexing failed:",
        e instanceof Error ? e.message : e,
      );
    }
  } catch (e) {
    error = message(e);
    if (photo && !saved)
      await unlink(path.resolve("storage/photos", photo)).catch(() => {});
  }
  if (error) go("/submit", "error", error);
  go(
    "/submit",
    "success",
    warning
      ? "Item saved. Bring it to security. Similar-item indexing is unavailable; run npm run db:setup later to rebuild it."
      : "Item submitted. Please deposit it at security; it will appear in the list after receipt.",
  );
}

export async function receiveItem(form: FormData) {
  const admin = await requireAdmin();
  let error: string | undefined;
  try {
    const id = positiveId(form, "item_id");
    const result = await execute(
      `UPDATE items SET status = 'available', received_by = ?, received_at = CURRENT_TIMESTAMP
      WHERE item_id = ? AND status = 'awaiting_deposit'`,
      [admin.user_id, id],
    );
    if (result.affectedRows !== 1)
      throw new InputError(
        "This item has already been received or does not exist.",
      );
  } catch (e) {
    error = message(e);
  }
  if (error) go("/manage", "error", error);
  go(
    "/manage",
    "success",
    "Receipt confirmed. The item is now available in the list.",
  );
}

export async function collectItem(form: FormData) {
  const admin = await requireAdmin();
  let error: string | undefined;
  try {
    if (form.get("id_checked") !== "yes")
      throw new InputError("Check the claimant’s college ID in person first.");
    const id = positiveId(form, "item_id");
    const name = text(form, "claimant_name", 100);
    const college = collegeId(form, "claimant_college_id");
    await execute("CALL collect_item(?, ?, ?, ?)", [
      id,
      name,
      college,
      admin.user_id,
    ]);
  } catch (e) {
    error = message(e);
  }
  if (error) go("/manage", "error", error);
  go(
    "/manage",
    "success",
    "Collection recorded. Hand the item to the verified claimant.",
  );
}

export async function createUser(form: FormData) {
  await requireAdmin();
  let error: string | undefined;
  try {
    const id = collegeId(form);
    const name = text(form, "full_name", 100);
    const password = text(form, "password", 128);
    if (password.length < 8)
      throw new InputError("Use a password of at least 8 characters.");
    const role = text(form, "role", 10);
    if (role !== "user" && role !== "admin")
      throw new InputError("Choose a valid role.");
    await execute(
      "INSERT INTO users(college_id, full_name, password_hash, role) VALUES (?, ?, ?, ?)",
      [id, name, hashPassword(password), role],
    );
  } catch (e) {
    error = message(e);
  }
  if (error) go("/accounts", "error", error);
  go(
    "/accounts",
    "success",
    "Account created. Share the college ID and password in person.",
  );
}
