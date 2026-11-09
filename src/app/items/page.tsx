import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { publicItems } from "@/lib/items";
import { Header, ItemCard, Notice, type SearchParams } from "@/components/ui";
export default async function Items({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const items = await publicItems();
  const params = await searchParams;
  const available = items.filter((item) => item.status === "available").length;
  return (
    <>
      <Header user={user} />
      <main className="container">
        <Notice {...params} />
        <section className="page-hero">
          <div>
            <span className="eyebrow">THE CAMPUS NOTICEBOARD</span>
            <h1>
              Lost it? <em>Let’s find it.</em>
            </h1>
            <p>
              A familiar backpack. Your favourite bottle. The little things
              worth finding.
            </p>
          </div>
          <Link className="button" href="/submit">
            ＋ Submit a found item
          </Link>
        </section>
        <div className="collection-bar">
          <h2>
            Found around campus <span>{items.length}</span>
          </h2>
          <span>
            <i className="status-dot" /> {available} available at security
          </span>
        </div>
        {items.length ? (
          <section className="item-grid" aria-label="Found items">
            {items.map((item) => (
              <ItemCard key={item.item_id} item={item} />
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>A clean noticeboard.</h2>
            <p>Items will appear here after security receives them.</p>
            <Link href="/submit">Submit the first item →</Link>
          </section>
        )}
        <aside className="info-strip">
          <strong>Recognise something?</strong>
          <span>
            Visit security with your college ID. Staff will verify your details
            and hand it over.
          </span>
        </aside>
      </main>
    </>
  );
}
