export default function Loading() {
  return (
    <main
      id="main"
      className="container"
      aria-busy="true"
      aria-label="Loading page"
      style={{ paddingBlock: 70 }}
    >
      <div
        className="a-skeleton"
        style={{ height: 40, width: "65%", marginBottom: 24 }}
      />
      <div className="a-skeleton" style={{ height: 180 }} />
    </main>
  );
}
