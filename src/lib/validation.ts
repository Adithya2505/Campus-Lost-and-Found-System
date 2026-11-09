export class InputError extends Error {}
export function text(
  form: FormData,
  key: string,
  max: number,
  optional = false,
) {
  const entry = form.get(key);
  const value = typeof entry === "string" ? entry.trim() : "";
  if ((!optional && !value) || value.length > max)
    throw new InputError(
      `Please enter a valid ${key.replaceAll("_", " ")} (maximum ${max} characters).`,
    );
  return value;
}
export function collegeId(form: FormData, key = "college_id") {
  const value = text(form, key, 30).toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(value))
    throw new InputError(
      "College ID must contain 2–30 letters, numbers, hyphens or underscores.",
    );
  return value;
}
export function positiveId(form: FormData, key: string) {
  const value = Number(form.get(key));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new InputError("Invalid item or category.");
  return value;
}
export function foundDate(form: FormData) {
  const value = text(form, "found_date", 10);
  const parsed = new Date(value + "T00:00:00");
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}` !==
      value ||
    parsed > today
  )
    throw new InputError("Enter a real found date that is not in the future.");
  return value;
}
export function photoExtension(bytes: Buffer) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "jpg";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  throw new InputError("Upload a JPG, PNG or WebP photo.");
}
