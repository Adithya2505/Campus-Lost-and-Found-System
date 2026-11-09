import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { itemVector } from "../src/lib/vectors";
import { photoExtension, foundDate, collegeId } from "../src/lib/validation";

test("password hashes use unique salts and reject wrong passwords", () => {
  const first = hashPassword("Campus123!");
  assert.notEqual(first, hashPassword("Campus123!"));
  assert.equal(verifyPassword("Campus123!", first), true);
  assert.equal(verifyPassword("wrong-password", first), false);
  assert.equal(verifyPassword("Campus123!", "bad-hash"), false);
});
test("related descriptions rank closer than an unrelated item", () => {
  function cosine(a: number[], b: number[]) {
    return (
      a.reduce((n, v, i) => n + v * b[i], 0) /
      (Math.hypot(...a) * Math.hypot(...b))
    );
  }
  const original = itemVector("black wireless headphones sony padded headband");
  const related = itemVector("sony black headphones wireless carrying case");
  const unrelated = itemVector("pink water bottle screw cap");
  assert.equal(original.length, 128);
  assert.ok(cosine(original, related) > cosine(original, unrelated));
  assert.ok(Math.hypot(...itemVector("the and")) > 0);
});
test("photos are checked by content rather than filename", () => {
  assert.equal(photoExtension(Buffer.from([255, 216, 255, 0])), "jpg");
  assert.throws(() => photoExtension(Buffer.from("<svg onload='alert(1)'>")));
});
test("college IDs and dates reject invalid values", () => {
  const form = new FormData();
  form.set("college_id", " stu001 ");
  assert.equal(collegeId(form), "STU001");
  form.set("college_id", "x' OR 1=1 --");
  assert.throws(() => collegeId(form));
  form.set("found_date", "2026-02-30");
  assert.throws(() => foundDate(form));
  form.set("found_date", "2999-01-01");
  assert.throws(() => foundDate(form));
  form.set("found_date", "2020-02-29");
  assert.equal(foundDate(form), "2020-02-29");
});
