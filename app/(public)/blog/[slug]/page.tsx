import { seoMetadata } from "@/lib/seo";
import StructuredData from "@/components/structured-data";
import { notFound } from "next/navigation";
import { getSiteSnapshot } from "@/lib/cms/public";
import { cleanHtml } from "@/lib/cms/store";
import { Artwork, Button } from "@/components/site";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSiteSnapshot();
  const a = data.blog.find((a) => a.slug === slug);
  return seoMetadata(a, `/blog/${slug}`);
}
export default async function Article({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSiteSnapshot();
  const a = data.blog.find((a) => a.slug === slug);
  if (!a) notFound();
  return (
    <main id="main">
      <StructuredData record={a} />
      <article className="container page-content">
        <header className="page-hero">
          <span className="eyebrow">
            {a.data.category} / {a.data.author}
          </span>
          <h1>{a.title}</h1>
          <p>{a.description}</p>
          {a.data.publishedAt && (
            <p className="caption">
              {new Date(a.data.publishedAt).toLocaleDateString()}
            </p>
          )}
        </header>
        <div className="detail-image">
          <Artwork src={a.data.image} alt={a.title} priority />
        </div>
        <div
          className="prose prose-content"
          dangerouslySetInnerHTML={{ __html: cleanHtml(a.data.body || "") }}
        />
        <div className="prose">
          <Button href="/blog">More perspectives</Button>
        </div>
      </article>
    </main>
  );
}
