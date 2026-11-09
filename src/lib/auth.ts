import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { redis } from "./redis";
import { rows } from "./db";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "campus_session";
const SESSION_SECONDS = 8 * 60 * 60;
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await (
    await redis()
  ).set(`campus:session:${token}`, String(userId), { EX: SESSION_SECONDS });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const userId = await (await redis()).get(`campus:session:${token}`);
  if (!userId) return null;
  const [user] = await rows<SessionUser>(
    "SELECT user_id, college_id, full_name, role FROM users WHERE user_id = ?",
    [Number(userId)],
  );
  return user || null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/items?error=Security+access+required");
  return user;
}
export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await (await redis()).del(`campus:session:${token}`);
  (await cookies()).delete(SESSION_COOKIE);
}
