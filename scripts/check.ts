import "dotenv/config";
import { rows, database } from "../src/lib/db";
import { redis } from "../src/lib/redis";
import { vectorDb } from "../src/lib/vectors";
async function check() {
  console.log(
    "MySQL:",
    await rows("SELECT VERSION() AS version, COUNT(*) AS items FROM items"),
  );
  const cache = await redis();
  console.log("Redis:", await cache.ping());
  const pg = await vectorDb();
  console.log("PostgreSQL:", (await pg.query("SELECT version()")).rows);
  console.log(
    "pgvector:",
    (
      await pg.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
      )
    ).rows,
  );
  console.log(
    "Vectors:",
    (await pg.query("SELECT COUNT(*) FROM item_vectors")).rows,
  );
  await cache.quit();
  await pg.close();
  await database().end();
}
check()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
