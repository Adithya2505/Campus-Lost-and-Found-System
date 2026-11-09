import { currentUser } from "@/lib/auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await currentUser()))
    return new Response("Sign in required", { status: 401 });
  const { name } = await params;
  if (!/^[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(name))
    return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(path.resolve("storage/photos", name));
    const type = name.endsWith("png")
      ? "image/png"
      : name.endsWith("webp")
        ? "image/webp"
        : "image/jpeg";
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
