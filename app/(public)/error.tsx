"use client";
export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="public-error">
      <h2>We couldn’t load this page.</h2>
      <p>The content service may be temporarily unavailable.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
