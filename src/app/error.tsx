"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container narrow">
      <section className="panel empty-state">
        <h1>Could not load the page.</h1>
        <p>
          Check that the local database services are running, then try again.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
