import { requireUser } from "@/lib/auth";
import { categories } from "@/lib/items";
import { Header, Notice, type SearchParams } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { submitItem } from "@/app/actions";
export default async function Submit({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const cats = await categories();
  return (
    <>
      <Header user={user} />
      <main className="container narrow">
        <div className="page-heading">
          <span className="eyebrow">A SMALL ACT OF KINDNESS</span>
          <h1>Found something?</h1>
          <p>Add the details below, then deposit the item at security.</p>
        </div>
        <Notice {...await searchParams} />
        <form action={submitItem} className="panel form-stack">
          <div className="form-row">
            <label>
              Item name
              <input
                name="item_name"
                maxLength={100}
                required
                placeholder="e.g. Black wireless earbuds"
              />
            </label>
            <label>
              Category
              <select name="category_id" required defaultValue="">
                <option value="" disabled>
                  Select a category
                </option>
                {cats.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              rows={4}
              maxLength={1500}
              required
              placeholder="Describe identifying features: marks, stickers, model, size, or accessories."
            />
          </label>
          <div className="form-row">
            <label>
              Colour
              <input
                name="color"
                maxLength={50}
                required
                placeholder="e.g. Black"
              />
            </label>
            <label>
              Brand <span className="optional">(optional)</span>
              <input name="brand" maxLength={80} placeholder="e.g. boAt" />
            </label>
          </div>
          <div className="form-row">
            <label>
              Where was it found?
              <input
                name="found_location"
                maxLength={200}
                required
                placeholder="e.g. Library, second-floor reading table"
              />
            </label>
            <label>
              Date found
              <input
                name="found_date"
                type="date"
                max={new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Kolkata",
                }).format(new Date())}
                required
              />
            </label>
          </div>
          <label>
            Item photo
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
            <span className="help-text">JPG, PNG or WebP. Maximum 5 MB.</span>
          </label>
          <div className="form-end">
            <p>Your item becomes visible after security receives it.</p>
            <SubmitButton>Submit item →</SubmitButton>
          </div>
        </form>
      </main>
    </>
  );
}
