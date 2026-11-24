import { PrismaClient } from "@prisma/client";
import { projects, services, articles, faqs } from "../lib/data";
import { modules, permissionKeys, rolePermissions } from "../lib/cms/registry";
try {
  process.loadEnvFile(".env.local");
} catch {}
const prisma = new PrismaClient();
async function put(
  module: string,
  slug: string,
  title: string,
  description: string,
  data: object,
  sortOrder = 0,
  status = "published",
) {
  const model = prisma[
    modules[module].model as keyof PrismaClient
  ] as unknown as { upsert: (args: unknown) => Promise<unknown> };
  return model.upsert({
    where: { slug },
    update: {},
    create: { slug, title, description, data, sortOrder, status },
  });
}
async function main() {
  for (const key of permissionKeys)
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  for (const name of ["Super Admin", "Admin", "Editor", "Viewer"]) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const key of rolePermissions(name)) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  const pages = {
    home: [
      "We Transform Ideas Into Stunning Websites",
      "Elevate your online presence with thoughtful design, seamless experiences and carefully crafted development.",
    ],
    services: [
      "Services designed around your next chapter.",
      "Strategy, identity, design and development.",
    ],
    portfolio: [
      "High-quality work. Thoughtfully delivered.",
      "Explore original design concepts, made with intention.",
    ],
    about: [
      "Designing online encounters that motivate.",
      "Independent thinking. Considered design.",
    ],
    team: [
      "Different perspectives. One direction.",
      "Brand thinkers, digital designers and developers.",
    ],
    careers: [
      "Make room for your next chapter.",
      "Expressions of interest for future collaboration.",
    ],
    blog: [
      "Read our articles & publications.",
      "Notes on design, strategy and digital craft.",
    ],
    pricing: [
      "The right scope. A clear proposal.",
      "Tailored engagements, agreed upfront.",
    ],
    contact: ["Let’s make something matter.", "Tell us about your next idea."],
    privacy: [
      "Your privacy matters.",
      "How this website handles your information.",
    ],
    terms: ["A few ground rules.", "Information about using this website."],
  };
  for (const [slug, [title, description]] of Object.entries(pages))
    await put("pages", slug, title, description, { body: "" });
  for (const [i, p] of projects.entries())
    await put(
      "portfolio",
      p.slug,
      p.name,
      p.description,
      {
        category: p.category,
        year: Number(p.year),
        image: `/art/project-${p.art}.svg`,
        body: `<p>${p.description}</p><p>This self-initiated concept explores visual identity, content hierarchy and interaction. It is not a commissioned client engagement; no commercial results are claimed.</p>`,
        gallery: [],
        featured: i < 2,
      },
      i,
    );
  for (const [i, [title, description]] of services.entries())
    await put(
      "services",
      title.toLowerCase().replace(/[^a-z]+/g, "-"),
      title,
      description,
      { body: `<p>${description}</p>`, image: `/art/project-${i}.svg` },
      i,
    );
  for (const [i, a] of articles.entries())
    await put(
      "blog",
      a.slug,
      a.title,
      a.description,
      {
        body: a.body.map((p) => `<p>${p}</p>`).join(""),
        image: `/art/project-${a.art}.svg`,
        category: a.category,
        author: "Royal Studio editorial",
        publishedAt: "2026-11-23T00:00:00.000Z",
        featured: i === 0,
      },
      i,
    );
  for (const [i, [title, answer]] of faqs.entries())
    await put(
      "faqs",
      `faq-${i + 1}`,
      title,
      "",
      { answer, category: "General" },
      i,
    );
  const sections = [
    [
      "hero",
      "We Transform Ideas Into Stunning Websites",
      "Elevate your online presence with thoughtful design, seamless user experiences, and carefully crafted development.",
      { ctaLabel: "Book a call", ctaUrl: "/contact" },
    ],
    [
      "gallery",
      "Selected design explorations",
      "",
      {
        items: [0, 1, 2, 3, 2, 3, 4, 5].map((i, n) => ({
          title: projects[i].name,
          image: `/art/device-${n}.svg`,
          url: `/portfolio/${projects[i].slug}`,
        })),
      },
    ],
    [
      "logos",
      "Independent thinking. Extraordinary possibilities.",
      "Concept identities from our design explorations",
      { items: projects.map((p) => ({ title: p.name })) },
    ],
    [
      "about",
      "Designing Online Encounters That Motivate",
      "A considered eye and a curious mind. We connect your ambition with thoughtful design to create digital experiences with a clear sense of purpose.",
      {
        body: "From the first conversation to the final detail, collaboration is at the heart of our process. Your vision, our craft. Something extraordinary, together.",
        image: "/team.jpg",
        ctaLabel: "More info",
        ctaUrl: "/about",
      },
    ],
    [
      "portfolio",
      "High-quality work delivered thoughtfully.",
      "Explore original, self-initiated design concepts, made with intention.",
      {},
    ],
    [
      "photo-cta",
      "We are your design partner.",
      "Thoughtful creative collaboration for your brand’s next move.",
      { image: "/office.jpg", ctaLabel: "Book a call", ctaUrl: "/contact" },
    ],
    [
      "impact",
      "Building experiences with purpose.",
      "Four connected disciplines, from the first insight to the final line of code.",
      {
        items: [
          { title: "Connected disciplines", value: 4 },
          { title: "Concept explorations", value: 6 },
          { title: "Responsive layouts", value: 3 },
          { title: "Shared creative direction", value: 1 },
        ],
        body: "Figures describe this website’s scope, not company achievements.",
      },
    ],
    [
      "services",
      "Services designed to empower your digital presence.",
      "A connected approach to strategy, identity, design and development.",
      {},
    ],
    [
      "testimonials",
      "Good work starts with good relationships.",
      "Verified client feedback will appear here with permission.",
      {},
    ],
    [
      "blog",
      "Read our articles & publications.",
      "Ideas and observations at the meeting point of strategy, design and digital craft.",
      {},
    ],
    [
      "faq",
      "Frequently asked questions.",
      "Still curious? Start a conversation.",
      {},
    ],
    [
      "cta",
      "Ready to elevate your digital presence?",
      "A bold idea. A fresh perspective. A digital experience that feels entirely yours.",
      {
        ctaLabel: "Book a call",
        ctaUrl: "/contact",
        secondaryLabel: "Explore your options",
        secondaryUrl: "/pricing",
      },
    ],
  ];
  for (const [i, section] of sections.entries()) {
    const [kind, title, description, data] = section;
    await put(
      "sections",
      String(kind),
      String(title),
      String(description),
      { kind, ...(data as object) },
      i,
    );
  }
  await put("settings", "general", "Agency settings", "", {
    agencyName: "Royal Studio",
    email: "",
    phone: "",
    bookingUrl: "/contact",
    ctaLabel: "Book a call",
    socialLinks: [],
  });
  await put("footer", "footer", "Footer", "", {
    copyright: "Royal Studio. All rights reserved.",
    tagline: "Independent minds. Considered design.",
    socialLinks: [],
  });
  await put("seo", "seo", "Default SEO", "", {
    seoTitle: "Royal Studio — Independent design & development",
    seoDescription:
      "Thoughtful design, distinctive brands and digital experiences.",
  });
  for (const [i, title] of [
    "Services",
    "Portfolio",
    "About",
    "Blog",
    "Pricing",
    "Contact",
  ].entries())
    await put(
      "navigation",
      title.toLowerCase(),
      title,
      "",
      { url: `/${title.toLowerCase()}`, placement: "header" },
      i,
    );
  const legacy = await prisma.$queryRawUnsafe<
    Array<{
      id: bigint;
      name: string;
      email: string;
      service: string;
      message: string;
      created_at: Date;
    }>
  >("SELECT * FROM enquiries");
  for (const row of legacy)
    await prisma.contactMessage.upsert({
      where: { slug: `legacy-${row.id}` },
      update: {},
      create: {
        slug: `legacy-${row.id}`,
        title: `${row.service} inquiry`,
        description: row.message.slice(0, 150),
        status: "unread",
        data: {
          name: row.name,
          email: row.email,
          service: row.service,
          message: row.message,
        },
        createdAt: row.created_at,
      },
    });
  console.log(
    "Existing content imported idempotently; original enquiries preserved. No fake business data seeded.",
  );
}
main().finally(() => prisma.$disconnect());
