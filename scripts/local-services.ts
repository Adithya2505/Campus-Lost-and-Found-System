// Infrastructure only: private native MySQL and Redis processes, no Windows services.
import "dotenv/config";
import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import mysql from "mysql2/promise";
import { createClient } from "redis";
import { pathToFileURL } from "node:url";

export type Runtime = { mysqlBin: string; redisBin: string };
export async function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
function background(exe: string, args: string[], cwd: string, log: string) {
  const fd = openSync(log, "a");
  const child = spawn(exe, args, {
    cwd,
    windowsHide: true,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.on("error", (error) =>
    console.error(`Cannot start ${path.basename(exe)}: ${error.message}`),
  );
  child.unref();
  closeSync(fd);
}
async function waitFor(port: number, name: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await portOpen(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `${name} did not start. See .local/${name.toLowerCase()}.log`,
  );
}
async function waitForStop(port: number) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!(await portOpen(port))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Database on port ${port} did not finish stopping.`);
}
export async function startServices() {
  const config: Runtime = JSON.parse(
    await readFile(".local/runtime.json", "utf8"),
  );
  const local = path.resolve(".local");
  const mysqlPort = Number(process.env.MYSQL_PORT);
  const redisPort = Number(new URL(process.env.REDIS_URL!).port);
  await mkdir(path.join(local, "redis-data"), { recursive: true });
  if (!(await portOpen(mysqlPort))) {
    background(
      path.join(config.mysqlBin, "mysqld.exe"),
      [
        "--no-defaults",
        `--basedir=${path.dirname(config.mysqlBin)}`,
        `--datadir=${path.join(local, "mysql-data")}`,
        `--port=${mysqlPort}`,
        "--bind-address=127.0.0.1",
        "--mysqlx=OFF",
        "--skip-log-bin",
        "--console",
      ],
      process.cwd(),
      path.join(local, "mysql.log"),
    );
    await waitFor(mysqlPort, "MySQL");
  }
  if (!(await portOpen(redisPort))) {
    // Relative config path works with the portable Cygwin Redis build.
    background(
      config.redisBin,
      ["redis.conf"],
      path.dirname(config.redisBin),
      path.join(local, "redis.log"),
    );
    await waitFor(redisPort, "Redis");
  }
  console.log(
    `Local MySQL: 127.0.0.1:${mysqlPort}; Redis: 127.0.0.1:${redisPort}`,
  );
}
async function stopMySQL() {
  if (!(await portOpen(Number(process.env.MYSQL_PORT)))) {
    console.log("MySQL is already stopped.");
    return;
  }
  const root = await mysql.createConnection({
    host: "127.0.0.1",
    port: Number(process.env.MYSQL_PORT),
    user: "root",
    password: process.env.LOCAL_MYSQL_ROOT_PASSWORD,
  });
  try {
    const [result] = await root.query<mysql.RowDataPacket[]>(
      "SELECT @@datadir AS directory",
    );
    const actual = path.resolve(String(result[0].directory)).toLowerCase();
    const expected = path.resolve(".local/mysql-data").toLowerCase();
    if (actual !== expected) {
      throw new Error(
        "Refusing to stop a MySQL instance outside this project.",
      );
    }
    await root.query("SHUTDOWN").catch((error) => {
      if (error.code !== "PROTOCOL_CONNECTION_LOST") throw error;
    });
  } finally {
    await root.end().catch(() => {});
  }
  await waitForStop(Number(process.env.MYSQL_PORT));
  console.log("MySQL stopped.");
}

async function stopRedis() {
  const redisPort = Number(new URL(process.env.REDIS_URL!).port || 6379);
  if (!(await portOpen(redisPort))) {
    console.log("Redis is already stopped.");
    return;
  }
  const redis = createClient({
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: false, connectTimeout: 3000 },
  });
  redis.on("error", () => {});
  await redis.connect();
  try {
    const redisDir = await redis.configGet("dir");
    // Portable Redis can return /cygdrive/c/... rather than C:/... .
    const directory = String(redisDir.dir).replace(
      /^\/cygdrive\/([a-z])\//i,
      "$1:/",
    );
    if (
      path.resolve(directory).toLowerCase() !==
      path.resolve(".local/redis-data").toLowerCase()
    ) {
      throw new Error("Refusing to stop Redis outside this project.");
    }
    await redis.sendCommand(["SHUTDOWN", "NOSAVE"]).catch(async (error) => {
      // Redis normally closes its connection instead of replying to SHUTDOWN.
      // Verify the server really stopped before treating that disconnect as success.
      if (
        error instanceof Error &&
        error.message === "Socket closed unexpectedly"
      ) {
        await waitForStop(redisPort);
      } else {
        throw error;
      }
    });
  } finally {
    if (redis.isOpen) redis.destroy();
  }
  await waitForStop(redisPort);
  console.log("Redis stopped.");
}

export async function stopServices() {
  // Require our marker; never shut down independently configured databases.
  await readFile(".local/runtime.json", "utf8");
  const errors: string[] = [];
  // Attempt each service even when the other is unavailable or fails to stop.
  for (const stop of [stopMySQL, stopRedis]) {
    try {
      await stop();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Project database processes stopped. Data is preserved.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  (process.argv[2] === "stop" ? stopServices() : startServices())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
