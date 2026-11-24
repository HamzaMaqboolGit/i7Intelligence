// Layouts persist during client navigation. Animate individual content sections,
// rather than fading/remounting the entire application chrome on every route.
export default function Template({ children }: { children: React.ReactNode }) {
  return children;
}
