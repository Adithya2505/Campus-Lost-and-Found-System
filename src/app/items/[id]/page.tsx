import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publicItem, similarItems } from "@/lib/items";
import { Header, Badge, ItemCard, formatDate } from "@/components/ui";
export default async function ItemDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const item = await publicItem(id);
  if (!item) notFound();
  let related: Awaited<ReturnType<typeof similarItems>> = [];
  let vectorUnavailable = false;
  try {
    related = await similarItems(id);
  } catch {
    vectorUnavailable = true;
  }
  return (
    <>
      <Header user={user} />
      <main className="container">
        <Link className="back-link" href="/items">
          ← All items
        </Link>
        <section className="detail-grid">
          <div className="detail-photo">
            <img src={`/media/${item.photo_path}`} alt={item.item_name} />
          </div>
          <div className="detail-content">
            <div className="detail-meta">
              <span className="eyebrow">
                {item.category_name} · #
                {item.item_id.toString().padStart(3, "0")}
              </span>
              <Badge status={item.status} />
            </div>
            <h1>{item.item_name}</h1>
            <p className="detail-description">{item.description}</p>
            <dl className="facts">
              <div>
                <dt>Colour</dt>
                <dd>{item.color}</dd>
              </div>
              <div>
                <dt>Brand</dt>
                <dd>{item.brand || "Not specified"}</dd>
              </div>
              <div>
                <dt>Found at</dt>
                <dd>{item.found_location}</dd>
              </div>
              <div>
                <dt>Date found</dt>
                <dd>{formatDate(item.found_date)}</dd>
              </div>
            </dl>
            <div className="pickup-note">
              <h2>
                {item.status === "collected"
                  ? "Back where it belongs."
                  : "Think this belongs to you?"}
              </h2>
              <p>
                {item.status === "collected"
                  ? "This item has been collected. Collector details are kept private."
                  : "Visit the campus security desk with your college ID and quote the item number. Security will verify your details before handing it over."}
              </p>
            </div>
          </div>
        </section>
        <section className="related">
          <div className="collection-bar">
            <h2>Similar items</h2>
            <span>Other finds you might recognise</span>
          </div>
          {vectorUnavailable ? (
            <p className="muted">Similar items are temporarily unavailable.</p>
          ) : related.length ? (
            <div className="item-grid">
              {related.map((i) => (
                <ItemCard key={i.item_id} item={i} />
              ))}
            </div>
          ) : (
            <p className="muted">No other available items to suggest yet.</p>
          )}
        </section>
      </main>
    </>
  );
}
