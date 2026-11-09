// One-time developer utility. The application never downloads photos at runtime.
import { mkdir, writeFile } from "node:fs/promises";
const photos = {
  headphones: "photo-1505740420928-5e560c06d30e",
  backpack: "photo-1544816155-12df9643f363",
  bottle: "photo-1602143407151-7111542de6e8",
  watch: "photo-1523275335684-37898b6baf30",
  shoes: "photo-1542291026-7eec264c27ff",
};
await mkdir("assets/photos", { recursive: true });
for (const [name, id] of Object.entries(photos)) {
  const url = `https://images.unsplash.com/${id}?w=1000&q=85&fit=crop&fm=jpg`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(`assets/photos/sample-${name}.jpg`, bytes);
  console.log(`Saved ${name} (${Math.round(bytes.length / 1024)} KB)`);
}
