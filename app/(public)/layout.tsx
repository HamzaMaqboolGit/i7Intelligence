import FooterPreviewMode from "@/components/footer-preview-mode";
import { getSiteSnapshot } from "@/lib/cms/public";
import { SiteProvider } from "@/components/site-context";
import { Header, Footer } from "@/components/site";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const data = await getSiteSnapshot();
  const settings = data.settings[0]?.data,
    seo = data.seo[0]?.data;
  return {
    title: {
      default: seo?.seoTitle || settings?.agencyName || "Royal Studio",
      template: `%s — ${settings?.agencyName || "Royal Studio"}`,
    },
    description: seo?.seoDescription,
    icons: settings?.favicon ? { icon: settings.favicon } : undefined,
    openGraph: seo?.ogImage ? { images: [seo.ogImage] } : undefined,
  };
}
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getSiteSnapshot();
  return (
    <SiteProvider data={data}>
      <FooterPreviewMode />
      <Header />
      {children}
      <Footer />
    </SiteProvider>
  );
}
