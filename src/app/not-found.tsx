import Link from "next/link";
export default function NotFound() {
  return (
    <main className="container narrow">
      <section className="panel empty-state">
        <h1>Item not found.</h1>
        <p>It may not have been received by security yet.</p>
        <Link className="button" href="/items">
          Back to items
        </Link>
      </section>
    </main>
  );
}
