import { seoMetadata } from "@/lib/seo";
import StructuredData from "@/components/structured-data";
import { notFound } from "next/navigation";
import { getSiteSnapshot } from "@/lib/cms/public";
import { cleanHtml } from "@/lib/cms/store";
import { Artwork, Button, ProjectCard } from "@/components/site";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSiteSnapshot();
  const p = data.portfolio.find((p) => p.slug === slug);
  return seoMetadata(p, `/portfolio/${slug}`);
}
export default async function Project({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSiteSnapshot();
  const p = data.portfolio.find((p) => p.slug === slug);
  if (!p) notFound();
  return (
    <main id="main">
      <StructuredData record={p} />
      <section className="page-hero container">
        <span className="eyebrow">
          {p.data.category} / {p.data.year}
        </span>
        <h1>{p.title}</h1>
        <p>{p.description}</p>
      </section>
      <div className="container page-content">
        <div className="detail-image">
          <Artwork src={p.data.image} alt={p.title} priority />
        </div>
        <div
          className="prose prose-content"
          dangerouslySetInnerHTML={{ __html: cleanHtml(p.data.body || "") }}
        />
        {p.data.gallery?.map(
          (image: { image: string; alt?: string }, i: number) => (
            <div className="detail-image" key={i}>
              <Artwork src={image.image} alt={image.alt || p.title} />
            </div>
          ),
        )}
        <div className="prose">
          <Button href={p.data.projectUrl || "/contact"}>
            {p.data.projectUrl ? "Visit project" : "Have a project in mind?"}
          </Button>
        </div>
        <h2 className="section" style={{ paddingBottom: 40 }}>
          More to explore.
        </h2>
        <div className="project-grid">
          {data.portfolio
            .filter((x) => x.id !== p.id)
            .slice(0, 2)
            .map((x) => (
              <ProjectCard project={x} key={x.id} />
            ))}
        </div>
      </div>
    </main>
  );
}
