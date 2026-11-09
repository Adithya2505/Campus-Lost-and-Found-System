// Run once while online. Everything required for the actual demo stays on disk.
import { config as loadEnv } from "dotenv";
import { randomBytes, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import mysql from "mysql2/promise";
import { startServices, portOpen } from "./local-services";

const REDIS_URL =
  "https://github.com/redis-windows/redis-windows/releases/download/8.10.3/Redis-8.10.3-Windows-x64-cygwin.zip";
const REDIS_SHA256 =
  "8000848c48668c8cd32f21386ce951d0e02c1aefae39443ab9d3de11ff8ebf9e";
async function findFile(
  directory: string,
  filename: string,
): Promise<string | undefined> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.name === filename) return full;
    if (entry.isDirectory()) {
      const result = await findFile(full, filename);
      if (result) return result;
    }
  }
}
async function main() {
  if (process.platform !== "win32")
    throw new Error(
      "This convenience script is for Windows. See README for manual database setup.",
    );
  await mkdir(".local", { recursive: true });
  if (!existsSync(".env")) {
    if ((await portOpen(13306)) || (await portOpen(16379)))
      throw new Error(
        "Demo ports 13306/16379 are busy. Stop the other process first.",
      );
    const appPassword = randomBytes(24).toString("hex");
    const rootPassword = randomBytes(24).toString("hex");
    const redisPassword = randomBytes(24).toString("hex");
    await writeFile(
      ".env",
      `MYSQL_HOST=127.0.0.1\nMYSQL_PORT=13306\nMYSQL_USER=campus_app\nMYSQL_PASSWORD=${appPassword}\nMYSQL_DATABASE=campus_lost_found\nREDIS_URL=redis://:${redisPassword}@127.0.0.1:16379\nLOCAL_MYSQL_ROOT_PASSWORD=${rootPassword}\nAPP_ORIGIN=http://127.0.0.1:3000\nVECTOR_DATA_DIR=storage/vectors\n`,
    );
  }
  loadEnv({ quiet: true });
  if (!process.env.LOCAL_MYSQL_ROOT_PASSWORD)
    throw new Error(
      "Existing .env uses manual databases. Follow README rather than demo:prepare.",
    );
  const mysqlFolder = "C:/Program Files/MySQL";
  const folders = existsSync(mysqlFolder) ? await readdir(mysqlFolder) : [];
  const mysqlBin =
    process.env.MYSQL_BIN ||
    folders
      .map((name) => path.join(mysqlFolder, name, "bin"))
      .find((bin) => existsSync(path.join(bin, "mysqld.exe")));
  if (!mysqlBin || !existsSync(path.join(mysqlBin, "mysqld.exe")))
    throw new Error("Install MySQL Server or set MYSQL_BIN to its bin folder.");
  const redisFolder = path.resolve(".local/redis");
  await mkdir(redisFolder, { recursive: true });
  let redisBin = await findFile(redisFolder, "redis-server.exe");
  if (!redisBin) {
    console.log("Downloading portable Redis for Windows (one-time setup)...");
    const response = await fetch(REDIS_URL);
    if (!response.ok)
      throw new Error(`Redis download failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== REDIS_SHA256)
      throw new Error("Redis archive checksum mismatch.");
    const archive = path.resolve(".local/redis.zip");
    await writeFile(archive, bytes);
    const escape = (value: string) => `'${value.replaceAll("'", "''")}'`;
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath ${escape(archive)} -DestinationPath ${escape(redisFolder)} -Force`,
      ],
      { windowsHide: true },
    );
    redisBin = await findFile(redisFolder, "redis-server.exe");
  }
  if (!redisBin)
    throw new Error("Redis executable not found after extraction.");
  await writeFile(
    ".local/runtime.json",
    JSON.stringify({ mysqlBin, redisBin }, null, 2),
  );
  const redisData = path.resolve(".local/redis-data").replaceAll("\\", "/");
  await mkdir(redisData, { recursive: true });
  await writeFile(
    path.join(path.dirname(redisBin), "redis.conf"),
    `bind 127.0.0.1\nport 16379\nprotected-mode yes\nrequirepass ${new URL(process.env.REDIS_URL!).password}\ndir "${redisData}"\nsave ""\nappendonly no\n`,
  );
  const data = path.resolve(".local/mysql-data");
  if (!existsSync(path.join(data, "mysql"))) {
    console.log(
      "Initializing a private MySQL data directory (existing databases are untouched)...",
    );
    await mkdir(data, { recursive: true });
    try {
      const output = execFileSync(
        path.join(mysqlBin, "mysqld.exe"),
        [
          "--no-defaults",
          `--basedir=${path.dirname(mysqlBin)}`,
          `--datadir=${data}`,
          "--initialize-insecure",
          "--console",
        ],
        {
          windowsHide: true,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      await writeFile(".local/mysql-init.log", output);
    } catch (e) {
      const error = e as { stderr?: Buffer };
      throw new Error(
        `MySQL initialization failed: ${error.stderr?.toString().slice(-1500)}`,
      );
    }
  }
  await startServices();
  const rootConfig = {
    host: "127.0.0.1",
    port: Number(process.env.MYSQL_PORT),
    user: "root",
  };
  let connection: mysql.Connection;
  try {
    connection = await mysql.createConnection({
      ...rootConfig,
      password: process.env.LOCAL_MYSQL_ROOT_PASSWORD,
    });
  } catch {
    connection = await mysql.createConnection(rootConfig);
  }
  const [info] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT @@datadir AS directory",
  );
  if (path.resolve(info[0].directory).toLowerCase() !== data.toLowerCase())
    throw new Error(
      "Refusing to configure a MySQL instance outside this project.",
    );
  await connection.query(
    "CREATE DATABASE IF NOT EXISTS campus_lost_found CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await connection.query(
    "CREATE USER IF NOT EXISTS 'campus_app'@'localhost' IDENTIFIED BY ?",
    [process.env.MYSQL_PASSWORD],
  );
  await connection.query(
    "GRANT ALL PRIVILEGES ON campus_lost_found.* TO 'campus_app'@'localhost'",
  );
  await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [
    process.env.LOCAL_MYSQL_ROOT_PASSWORD,
  ]);
  await connection.end();
  console.log(
    "Ready. Next: npm run db:setup, then npm run build and npm start.",
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
