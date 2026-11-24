import Link from "next/link";
import { seoMetadata } from "@/lib/seo";
import StructuredData from "@/components/structured-data";
import { notFound } from "next/navigation";
import { getSiteSnapshot } from "@/lib/cms/public";
import { Button, FinalCTA, ProjectCard, Artwork, FAQ } from "@/components/site";
import BookingForm from "@/components/booking-form";
import { cleanHtml } from "@/lib/cms/store";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const data = await getSiteSnapshot();
  const record = data.pages.find((r) => r.slug === page);
  return seoMetadata(record, `/${page}`);
}
export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const data = await getSiteSnapshot();
  const record = data.pages.find((r) => r.slug === page);
  if (!record || page === "home") notFound();
  const body = record.data.body;
  return (
    <main id="main">
      <StructuredData record={record} />
      <section className="page-hero container">
        <span className="eyebrow">
          {data.settings[0]?.data.agencyName || "ROYAL STUDIO"} /{" "}
          {page.toUpperCase()}
        </span>
        <h1>{record.title}</h1>
        <p>{record.description}</p>
      </section>
      <div className="container page-content">
        {body && (
          <div
            className="prose prose-content"
            dangerouslySetInnerHTML={{ __html: cleanHtml(body) }}
          />
        )}
        {page === "portfolio" && (
          <div className="project-grid">
            {data.portfolio.map((p) => (
              <ProjectCard project={p} key={p.id} />
            ))}
          </div>
        )}
        {page === "services" && (
          <div className="prose">
            {data.services.map((r) => (
              <section id={r.slug} key={r.id}>
                <h2>{r.title}</h2>
                <p>{r.description}</p>
                <div
                  className="prose-content"
                  dangerouslySetInnerHTML={{
                    __html: cleanHtml(r.data.body || ""),
                  }}
                />
                <Button>Discuss your project</Button>
              </section>
            ))}
          </div>
        )}
        {page === "about" && !body && (
          <>
            <img
              className="team-photo"
              src={
                data.sections.find((s) => s.data.kind === "about")?.data
                  .image || "/team.jpg"
              }
              alt="Illustrative studio collaboration"
              width={2000}
              height={1100}
            />
            <div className="prose">
              <h2>A considered approach to what comes next.</h2>
              <p>
                {
                  data.sections.find((s) => s.data.kind === "about")
                    ?.description
                }
              </p>
              <p>
                {data.sections.find((s) => s.data.kind === "about")?.data.body}
              </p>
              <Button href="/team">Explore our team</Button>
            </div>
          </>
        )}
        {page === "team" && (
          <>
            {data.team.length ? (
              <div className="blog-grid">
                {data.team.map((r) => (
                  <article key={r.id}>
                    {r.data.image && (
                      <img
                        className="team-photo"
                        style={{ height: 350 }}
                        src={r.data.image}
                        alt={r.title}
                      />
                    )}
                    <h3>{r.title}</h3>
                    <p>{r.data.position}</p>
                    <div
                      className="prose-content"
                      dangerouslySetInnerHTML={{
                        __html: cleanHtml(r.data.biography || ""),
                      }}
                    />
                    {r.data.socialLinks?.map(
                      (s: { label: string; url: string }, i: number) => (
                        <a
                          className="text-link"
                          href={s.url}
                          key={i}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {s.label}
                        </a>
                      ),
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="prose">
                <h2>Meet the minds behind the work.</h2>
                <p>
                  Team introductions will be shared here when approved profiles
                  are available.
                </p>
                <Button>Start a conversation</Button>
              </div>
            )}
          </>
        )}
        {page === "careers" && (
          <div className="prose">
            {data.careers.length ? (
              data.careers.map((r) => (
                <section key={r.id} className="career-row">
                  <div>
                    <h3>{r.title}</h3>
                    <p>
                      {[r.data.department, r.data.location, r.data.jobType]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div
                      className="prose-content"
                      dangerouslySetInnerHTML={{
                        __html: cleanHtml(r.data.body || ""),
                      }}
                    />
                    <Button
                      href={
                        r.data.applicationUrl ||
                        (r.data.applicationEmail
                          ? `mailto:${r.data.applicationEmail}`
                          : "/contact")
                      }
                    >
                      Apply / enquire
                    </Button>
                  </div>
                </section>
              ))
            ) : (
              <>
                <h2>Stay in the conversation.</h2>
                <p>
                  No positions are currently advertised. Introduce yourself if
                  you’re interested in future collaboration.
                </p>
                <Button href="/contact?service=Careers">
                  Introduce yourself
                </Button>
              </>
            )}
          </div>
        )}
        {page === "blog" && (
          <div className="project-grid">
            {data.blog.map((r) => (
              <Link
                href={`/blog/${r.slug}`}
                className="article-card"
                key={r.id}
              >
                <div className="article-image">
                  <Artwork src={r.data.image} alt={r.title} />
                </div>
                <span className="caption">{r.data.category}</span>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
              </Link>
            ))}
          </div>
        )}
        {page === "pricing" && !body && (
          <div className="pricing-grid" id="plans">
            {[
              ["Brand foundation", "A new identity or fresh perspective."],
              ["Digital experience", "A distinctive, custom website."],
              ["Creative partnership", "A connected programme of work."],
            ].map(([title, description]) => (
              <div className="pricing-card" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
                <strong>Let’s scope it.</strong>
                <p>
                  A tailored proposal with deliverables, timing and fees agreed
                  before work begins.
                </p>
                <Button>Request a proposal</Button>
              </div>
            ))}
          </div>
        )}
        {page === "contact" && (
          <>
            <BookingForm
              locations={data.locations}
              heading={record.data.bookingHeading}
              description={record.data.bookingDescription}
            />
          </>
        )}
        {page === "privacy" && !body && (
          <div className="prose">
            <h2>Information you share</h2>
            <p>
              Contact and booking forms collect your name, contact details and
              message to help us respond. Newsletter subscriptions require your
              consent. Please do not include passwords or sensitive personal
              information.
            </p>
            <h2>Your choices</h2>
            <p>
              Use the contact form to request access, correction or deletion of
              an enquiry. We do not include advertising trackers by default.
            </p>
            <p>
              The agency operator must complete its legal identity, contact
              address and retention policy before public launch.
            </p>
          </div>
        )}
        {page === "terms" && !body && (
          <div className="prose">
            <h2>Website content</h2>
            <p>
              Concept projects illustrate creative direction and do not imply
              client engagements or commercial results. Enquiries do not create
              a service agreement. Scope, fees and terms must be agreed
              separately in writing.
            </p>
            <h2>Creative assets</h2>
            <p>
              Original artwork was created for this website. Illustrative
              photography is licensed from Unsplash. Fonts use the SIL Open Font
              License.
            </p>
          </div>
        )}
      </div>
      {page === "pricing" && <FAQ />}
      {!["privacy", "terms", "contact"].includes(page) && <FinalCTA />}
    </main>
  );
}
