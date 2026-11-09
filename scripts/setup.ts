import "dotenv/config";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { database, execute, rows } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { saveVector, vectorDb } from "../src/lib/vectors";

// Understand DELIMITER so the same SQL file works here and in MySQL Workbench.
export function sqlStatements(source: string): string[] {
  let delimiter = ";";
  let statement = "";
  const results: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trim().startsWith("--")) continue;
    if (/^DELIMITER /i.test(line.trim())) {
      delimiter = line.trim().split(/\s+/)[1];
      continue;
    }
    statement += line + "\n";
    if (statement.trimEnd().endsWith(delimiter)) {
      results.push(statement.trimEnd().slice(0, -delimiter.length).trim());
      statement = "";
    }
  }
  if (statement.trim()) results.push(statement.trim());
  return results.filter(Boolean);
}
async function setup() {
  const sql = await readFile("database/mysql.sql", "utf8");
  for (const statement of sqlStatements(sql)) await database().query(statement);
  const [count] = await rows<{ total: number }>(
    "SELECT COUNT(*) AS total FROM users",
  );
  if (count.total === 0) {
    const connection = await database().getConnection();
    try {
      await connection.beginTransaction();
      for (const [id, name, role] of [
        ["SEC001", "Campus Security", "admin"],
        ["STU001", "Ananya Rao", "user"],
        ["STU002", "Rohan Mehta", "user"],
      ]) {
        await connection.execute(
          "INSERT INTO users(college_id,full_name,password_hash,role) VALUES (?,?,?,?)",
          [id, name, hashPassword("Campus123!"), role],
        );
      }
      for (const category of [
        "Electronics",
        "Bags",
        "Bottles",
        "Accessories",
        "Books",
        "Keys",
        "Other",
      ]) {
        await connection.execute(
          "INSERT INTO categories(category_name) VALUES (?)",
          [category],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    console.log(
      "Demo accounts: SEC001 (security), STU001 / STU002 (users). Password: Campus123!",
    );
  }
  await mkdir("storage/photos", { recursive: true });
  const seed = JSON.parse(
    await readFile("database/seed.json", "utf8"),
  ) as Array<{
    name: string;
    category: string;
    description: string;
    color: string;
    brand: string;
    photo: string;
    location: string;
    status: string;
  }>;
  for (const sample of seed)
    await copyFile(
      path.join("assets/photos", sample.photo),
      path.join("storage/photos", sample.photo),
    );
  const [itemCount] = await rows<{ total: number }>(
    "SELECT COUNT(*) AS total FROM items",
  );
  if (itemCount.total === 0) {
    const [admin] = await rows<{ user_id: number }>(
      "SELECT user_id FROM users WHERE role = 'admin' ORDER BY user_id LIMIT 1",
    );
    const [submitter] = await rows<{ user_id: number }>(
      "SELECT user_id FROM users WHERE role = 'user' ORDER BY user_id LIMIT 1",
    );
    for (const sample of seed) {
      const [category] = await rows<{ category_id: number }>(
        "SELECT category_id FROM categories WHERE category_name = ?",
        [sample.category],
      );
      const pending = sample.status === "awaiting_deposit";
      const result = await execute(
        `INSERT INTO items(category_id,item_name,description,color,brand,photo_path,found_location,found_date,submitted_by,status,received_by,received_at)
        VALUES (?,?,?,?,?,?,?,CURRENT_DATE,?,?,?,?)`,
        [
          category.category_id,
          sample.name,
          sample.description,
          sample.color,
          sample.brand,
          sample.photo,
          sample.location,
          submitter?.user_id || admin.user_id,
          pending ? "awaiting_deposit" : "available",
          pending ? null : admin.user_id,
          pending
            ? null
            : new Date().toISOString().slice(0, 19).replace("T", " "),
        ],
      );
      if (sample.status === "collected")
        await execute("CALL collect_item(?, ?, ?, ?)", [
          result.insertId,
          "Divya Kulkarni",
          "STU003",
          admin.user_id,
        ]);
    }
    console.log(`Seeded ${seed.length} found items.`);
  }
  // Rebuild secondary vectors from the authoritative MySQL records. Safe to rerun.
  const all = await rows<{ item_id: number; words: string }>(
    `SELECT i.item_id, CONCAT_WS(' ',c.category_name,i.item_name,i.color,i.brand,i.description) AS words FROM items i JOIN categories c ON c.category_id = i.category_id`,
  );
  for (const item of all) await saveVector(item.item_id, item.words);
  console.log(
    `MySQL schema ready; ${all.length} PostgreSQL/pgvector records indexed.`,
  );
  await (await vectorDb()).close();
  await database().end();
}
setup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
