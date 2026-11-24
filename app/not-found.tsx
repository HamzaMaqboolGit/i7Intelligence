import { Button } from "@/components/site";
export default function NotFound() {
  return (
    <main id="main" className="container page-hero">
      <span className="eyebrow">404 / A DIFFERENT DIRECTION</span>
      <h1>
        This page took
        <br />a wrong turn.
      </h1>
      <p>Let’s get you back to something good.</p>
      <div style={{ marginTop: 30 }}>
        <Button href="/">Back to the studio</Button>
      </div>
    </main>
  );
}
