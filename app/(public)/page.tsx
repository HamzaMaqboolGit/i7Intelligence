import { getSiteSnapshot } from "@/lib/cms/public";
import { seoMetadata } from "@/lib/seo";
import Homepage from "@/components/homepage";
export default function Home() {
  return <Homepage />;
}

export async function generateMetadata() {
  const data = await getSiteSnapshot();
  return seoMetadata(
    data.pages.find((r) => r.slug === "home") || data.seo[0],
    "/",
  );
}
