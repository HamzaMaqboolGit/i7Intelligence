"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="public-error">
      <h2>We couldn’t load this experience.</h2>
      <p>Please try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
