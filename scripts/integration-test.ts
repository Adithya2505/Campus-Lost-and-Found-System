import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database, execute, rows } from "../src/lib/db";
import { redis } from "../src/lib/redis";
import { saveVector, similarIds, vectorDb } from "../src/lib/vectors";

// Run with the website stopped: only one process may open embedded PostgreSQL.
async function main() {
  const [admin] = await rows<{ user_id: number }>(
    "SELECT user_id FROM users WHERE role='admin' LIMIT 1",
  );
  const [user] = await rows<{ user_id: number }>(
    "SELECT user_id FROM users WHERE role='user' LIMIT 1",
  );
  const [category] = await rows<{ category_id: number }>(
    "SELECT category_id FROM categories LIMIT 1",
  );
  const marker = `integration-${randomUUID()}`;
  const testIds: number[] = [];
  const cache = await redis();
  const pg = await vectorDb();
  try {
    for (let i = 0; i < 2; i++) {
      const item = await execute(
        `INSERT INTO items(category_id,item_name,description,color,brand,photo_path,found_location,found_date,submitted_by,status,received_by,received_at)
        VALUES (?,?,'black wireless headphones','Black','Sony','sample-headphones.jpg','Test desk',CURRENT_DATE,?,'available',?,CURRENT_TIMESTAMP)`,
        [category.category_id, marker, user.user_id, admin.user_id],
      );
      testIds.push(item.insertId);
    }
    const [first, second] = testIds;
    const publicRows = await rows<Record<string, unknown>>(
      "SELECT * FROM public_items WHERE item_id = ?",
      [first],
    );
    for (const field of [
      "claimant_name",
      "claimant_college_id",
      "submitted_by",
      "received_by",
      "password_hash",
    ])
      assert.equal(
        field in publicRows[0],
        false,
        `${field} must not be public`,
      );
    console.log("PASS: public SQL view excludes private identity fields");
    await assert.rejects(() =>
      execute("CALL collect_item(?,?,?,?)", [
        first,
        "Wrong role",
        "TEST01",
        user.user_id,
      ]),
    );
    assert.equal(
      (
        await rows<{ status: string }>(
          "SELECT status FROM items WHERE item_id=?",
          [first],
        )
      )[0].status,
      "available",
    );
    console.log(
      "PASS: trigger rejects non-security handover and transaction rolls back",
    );
    const attempts = await Promise.allSettled([
      execute("CALL collect_item(?,?,?,?)", [
        first,
        "First claimant",
        "TEST01",
        admin.user_id,
      ]),
      execute("CALL collect_item(?,?,?,?)", [
        first,
        "Second claimant",
        "TEST02",
        admin.user_id,
      ]),
    ]);
    assert.equal(
      attempts.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      (
        await rows<{ total: number }>(
          "SELECT COUNT(*) AS total FROM collections WHERE item_id=?",
          [first],
        )
      )[0].total,
      1,
    );
    assert.equal(
      (
        await rows<{ status: string }>(
          "SELECT status FROM items WHERE item_id=?",
          [first],
        )
      )[0].status,
      "collected",
    );
    console.log("PASS: two simultaneous claims produce exactly one collection");
    await execute(
      "UPDATE items SET status='awaiting_deposit', received_by=NULL, received_at=NULL WHERE item_id=?",
      [second],
    );
    await assert.rejects(() =>
      execute("CALL collect_item(?,?,?,?)", [
        second,
        "Pending claimant",
        "TEST03",
        admin.user_id,
      ]),
    );
    assert.equal(
      (
        await rows<{ total: number }>(
          "SELECT COUNT(*) AS total FROM collections WHERE item_id=?",
          [second],
        )
      )[0].total,
      0,
    );
    console.log("PASS: awaiting-deposit item cannot be handed over");
    await cache.set(`campus:test:${marker}`, "session-user", { EX: 60 });
    assert.equal(await cache.get(`campus:test:${marker}`), "session-user");
    assert.ok((await cache.ttl(`campus:test:${marker}`)) > 0);
    await cache.del(`campus:test:${marker}`);
    console.log("PASS: real Redis session values and expiration");
    await saveVector(first, "black wireless headphones Sony");
    await saveVector(second, "Sony black wireless headphones case");
    const ids = await similarIds(first);
    assert.ok(ids.includes(second));
    const vectorVersion = await pg.query(
      "SELECT extversion FROM pg_extension WHERE extname='vector'",
    );
    assert.equal(vectorVersion.rows.length, 1);
    console.log(
      "PASS: real PostgreSQL pgvector extension and nearest-neighbour query",
    );
  } finally {
    for (const id of testIds) {
      await execute("DELETE FROM collections WHERE item_id=?", [id]);
      await execute("DELETE FROM items WHERE item_id=?", [id]);
      await pg.query("DELETE FROM item_vectors WHERE item_id=$1", [id]);
    }
    await cache.del(`campus:test:${marker}`);
    await cache.quit();
    await pg.close();
    await database().end();
  }
}
main()
  .then(() => {
    console.log("All integration checks passed; temporary records removed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
