"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { ArrowUpRight, Menu, X, Plus } from "lucide-react";
import { motionTiming, cinematicEase } from "@/lib/motion";
import { useSite } from "./site-context";
import CartBadge from "./store/cart-badge";
import PublicMenu from "./public-menu";
import NewsletterForm from "./newsletter-form";
import type { CmsRecord } from "@/lib/cms/store";
function useSection(kind: string) {
  return useSite().sections?.find((s) => s.data.kind === kind);
}
export function Logo() {
  const site = useSite();
  const settings = site.settings?.[0]?.data;
  return (
    <Link
      href="/"
      className="logo"
      aria-label={`${settings?.agencyName || "Royal Studio"} home`}
    >
      {settings?.logo ? (
        <img src={settings.logo} alt="" width={32} height={32} />
      ) : (
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
        </span>
      )}
      <span className="brand-name">
        {settings?.agencyName || "Royal Studio"}
      </span>
    </Link>
  );
}
export function Button({
  href,
  children,
  secondary = false,
}: {
  href?: string;
  children?: React.ReactNode;
  secondary?: boolean;
}) {
  const settings = useSite().settings?.[0]?.data;
  return (
    <Link
      className={`button ${secondary ? "secondary" : ""}`}
      href={href || settings?.bookingUrl || "/contact"}
    >
      {children || settings?.ctaLabel || "Book a call"}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function Header() {
  const site = useSite();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () =>
      setScrolled((current) =>
        window.scrollY > 64 ? true : window.scrollY < 16 ? false : current,
      );
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={`header${scrolled ? " header-scrolled" : ""}`}
      data-header-state={scrolled ? "scrolled" : "top"}
    >
      <Logo />
      <nav
        aria-label="Main navigation"
        className={menu ? "navigation open" : "navigation"}
      >
        <div className="public-desktop-menu">
          <PublicMenu
            rows={
              site.navigation?.filter(
                (n) =>
                  (!n.data.placement || n.data.placement === "header") &&
                  n.data.url !== "/shop" &&
                  n.title.toLowerCase() !== "shop",
              ) || []
            }
            onNavigate={() => setMenu(false)}
          />
        </div>
        <div className="public-mobile-menu">
          <PublicMenu
            rows={
              site.navigation?.some((n) => n.data.placement === "mobile")
                ? site.navigation.filter(
                    (n) =>
                      n.data.placement === "mobile" &&
                      n.data.url !== "/shop" &&
                      n.title.toLowerCase() !== "shop",
                  )
                : site.navigation?.filter(
                    (n) =>
                      (!n.data.placement || n.data.placement === "header") &&
                      n.data.url !== "/shop" &&
                      n.title.toLowerCase() !== "shop",
                  ) || []
            }
            onNavigate={() => setMenu(false)}
          />
        </div>
      </nav>
      <div className="header-actions">
        <div className="header-store-entry">
          <Link href="/shop" className="header-shop-link">
            Shop
          </Link>
          <CartBadge />
        </div>
        <Button
          href={site.settings?.[0]?.data.secondaryUrl || "/contact"}
          secondary
        >
          {site.settings?.[0]?.data.secondaryLabel || "Let’s talk"}
        </Button>
        <Button />
      </div>
      <button
        className="mobile-menu"
        aria-label={menu ? "Close navigation" : "Open navigation"}
        aria-expanded={menu}
        onClick={() => setMenu(!menu)}
      >
        {menu ? <X /> : <Menu />}
      </button>
    </header>
  );
}
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      data-motion="section"
      className={className}
      initial={reduced ? false : { opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{
        duration: motionTiming.section,
        delay,
        ease: cinematicEase,
      }}
    >
      {children}
    </motion.div>
  );
}
export function SplitHeading({
  title,
  description,
  href,
  label = "View all",
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <Reveal className="split-heading">
      <h2>{title}</h2>
      <div>
        <p>{description}</p>
        {href && (
          <Link className="text-link" href={href}>
            {label}
            <ArrowUpRight size={19} />
          </Link>
        )}
      </div>
    </Reveal>
  );
}
export function Artwork({
  index = 0,
  src,
  alt = "Original design concept artwork",
  priority = false,
}: {
  index?: number;
  src?: string;
  alt?: string;
  priority?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      data-motion="image"
      className="image-reveal"
      initial={reduced ? false : { opacity: 0, scale: 1.07 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: motionTiming.image, ease: cinematicEase }}
    >
      <img
        src={src || `/art/project-${index % 6}.svg`}
        alt={alt}
        width={1200}
        height={900}
        loading={priority ? "eager" : "lazy"}
        className="artwork"
      />
    </motion.div>
  );
}
export function Hero() {
  const s = useSection("hero");
  if (!s) return null;
  return (
    <section className="hero container">
      <Reveal>
        {s.data.eyebrow && <span className="eyebrow">{s.data.eyebrow}</span>}
        <h1>{s.title}</h1>
        <p>{s.description}</p>
        <Button href={s.data.ctaUrl}>{s.data.ctaLabel}</Button>
      </Reveal>
    </section>
  );
}
export function Gallery() {
  const items = useSection("gallery")?.data.items || [];
  return (
    <div
      className="gallery container"
      aria-label="Selected design explorations"
    >
      {[0, 1, 2, 3].map((n) => (
        <Reveal
          key={n}
          className={`gallery-column column-${n}`}
          delay={n * motionTiming.stagger}
        >
          {[items[n], items[n + 4]].filter(Boolean).map((item, i) => (
            <Link
              key={i}
              href={item.url || "/portfolio"}
              className="gallery-frame"
            >
              <Artwork
                src={item.image}
                alt={item.title || "Original device artwork"}
                priority={i === 0}
              />
            </Link>
          ))}
        </Reveal>
      ))}
    </div>
  );
}
export function Marquee() {
  const s = useSection("logos");
  const clients =
    useSite().clients?.filter((r) => r.data.permission && r.data.image) || [];
  const items = clients.length
    ? clients.map((c) => ({ title: c.title, image: c.data.image }))
    : s?.data.items || [];
  return (
    <section className="marquee" aria-label="Brand explorations">
      <div className="marquee-track">
        {[0, 1].map((n) => (
          <div className="logo-set" key={n} aria-hidden={n === 1}>
            {items.map((item: { title: string; image?: string }, i: number) => (
              <span key={i}>
                {item.image ? (
                  <img src={item.image} alt={item.title} />
                ) : (
                  item.title
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
      {s?.description && <p className="caption">{s.description}</p>}
    </section>
  );
}
export function AboutSection() {
  const s = useSection("about");
  if (!s) return null;
  return (
    <section className="about-section">
      <div className="container">
        <SplitHeading
          title={s.title}
          description={s.description || ""}
          href={s.data.ctaUrl || "/about"}
          label={s.data.ctaLabel || "More info"}
        />
        <Reveal className="about-paragraph">
          <p>{s.data.body}</p>
        </Reveal>
        {s.data.image && (
          <Reveal>
            <img
              className="team-photo"
              src={s.data.image}
              alt="Illustrative creative studio collaboration"
              width={2000}
              height={1100}
            />
          </Reveal>
        )}
      </div>
    </section>
  );
}
export function ProjectCard({ project }: { project: CmsRecord }) {
  const px = useMotionValue(0),
    py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 160, damping: 25 }),
    y = useSpring(py, { stiffness: 160, damping: 25 });
  return (
    <Reveal>
      <Link
        href={`/portfolio/${project.slug}`}
        className="project-card"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          px.set(e.clientX - r.left);
          py.set(e.clientY - r.top);
        }}
      >
        <div className="project-image">
          <Artwork src={project.data.image} alt={project.title} />
        </div>
        <motion.span
          aria-hidden="true"
          className="project-cursor"
          style={{ left: x, top: y }}
        >
          View
          <ArrowUpRight size={20} />
        </motion.span>
        <div className="project-meta">
          <h3>{project.title}</h3>
          {project.data.category && (
            <span className="pill">{project.data.category}</span>
          )}
          <span className="muted">{project.data.year}</span>
        </div>
        <p>{project.description}</p>
      </Link>
    </Reveal>
  );
}
export function PortfolioSection() {
  const s = useSection("portfolio"),
    projects = useSite().portfolio || [];
  if (!s) return null;
  return (
    <section className="section container" id="work">
      <SplitHeading
        title={s.title}
        description={s.description || ""}
        href="/portfolio"
      />
      <div className="project-grid">
        {projects.slice(0, 6).map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}
export function PhotoCTA() {
  const s = useSection("photo-cta");
  if (!s) return null;
  return (
    <section className="container">
      <Reveal className="photo-cta">
        {s.data.image && (
          <img
            src={s.data.image}
            alt="Creative workspace"
            className="photo-background"
          />
        )}
        <div>
          <h2>{s.title}</h2>
          <p>{s.description}</p>
          <Button href={s.data.ctaUrl}>{s.data.ctaLabel}</Button>
        </div>
      </Reveal>
    </section>
  );
}
function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const view = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [count, setCount] = useState(value);
  useEffect(() => {
    if (!view || reduced) return;
    let start = 0,
      frame: number;
    function run(time: number) {
      if (!start) start = time;
      const p = Math.min((time - start) / (motionTiming.counter * 1000), 1);
      setCount(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(run);
    }
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [view, value, reduced]);
  return <span ref={ref}>{count}</span>;
}
export function Impact() {
  const s = useSection("impact");
  if (!s) return null;
  return (
    <section className="section container">
      <SplitHeading
        title={s.title}
        description={s.description || ""}
        href="/about"
        label="Our approach"
      />
      <div className="stats">
        {(s.data.items || []).map(
          (item: { value: number; title: string }, i: number) => (
            <Reveal className="stat" key={i}>
              <strong>
                <Counter value={Number(item.value) || 0} />
              </strong>
              <span>{item.title}</span>
            </Reveal>
          ),
        )}
      </div>
      {s.data.body && <p className="caption">{s.data.body}</p>}
    </section>
  );
}
export function ServicesSection() {
  const s = useSection("services"),
    services = useSite().services || [];
  if (!s) return null;
  return (
    <section className="section container services-section">
      <Reveal>
        <h2>{s.title}</h2>
        <p>{s.description}</p>
        <Link href="/services" className="text-link">
          Explore our services
          <ArrowUpRight size={19} />
        </Link>
      </Reveal>
      <div className="service-list">
        {services.map((r) => (
          <Reveal key={r.id}>
            <Link href={`/services#${r.slug}`}>
              <h3>
                {r.title}
                <ArrowUpRight size={23} />
              </h3>
              <p>{r.description}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
export function Testimonials() {
  const s = useSection("testimonials"),
    records = useSite().testimonials || [];
  return (
    <section className="soft section" id="testimonials">
      <div className="container">
        <SplitHeading
          title={s?.title || "What our clients say."}
          description={s?.description || ""}
        />
        <div className="testimonials">
          {records.length
            ? records.map((r) => (
                <Reveal className="testimonial" key={r.id}>
                  <div className="avatar">
                    {r.data.image ? (
                      <img src={r.data.image} alt={r.title} />
                    ) : (
                      r.title.slice(0, 1)
                    )}
                  </div>
                  <span
                    className="stars"
                    aria-label={`${r.data.rating} out of 5 stars`}
                  >
                    {"★".repeat(Number(r.data.rating) || 0)}
                  </span>
                  <p>{r.data.review}</p>
                  <div className="testimonial-author">
                    <strong>{r.title}</strong>
                    <span>
                      {[r.data.role, r.data.company]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </Reveal>
              ))
            : [
                "The collaboration",
                "The creative process",
                "The finished experience",
              ].map((t, i) => (
                <Reveal className="testimonial" key={t}>
                  <div className="avatar" aria-hidden="true">
                    {["◉", "✳", "◈"][i]}
                  </div>
                  <h3>{t}</h3>
                  <p>
                    Reserved for verified client feedback, published with
                    permission.
                  </p>
                  <div className="testimonial-author">
                    <strong>Awaiting client perspectives</strong>
                  </div>
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}
export function BlogSection() {
  const s = useSection("blog"),
    records = useSite().blog || [];
  const a = records[0];
  return (
    <section className="section container">
      <SplitHeading
        title={s?.title || "Fresh perspectives."}
        description={s?.description || ""}
        href="/blog"
      />
      {a && (
        <Link className="featured-article" href={`/blog/${a.slug}`}>
          <div className="article-image">
            <Artwork src={a.data.image} alt={a.title} />
          </div>
          <div>
            <span className="pill">{a.data.category}</span>
            <h3>{a.title}</h3>
            <p>{a.description}</p>
            <div className="article-byline">
              <span className="small-brand">✳</span>
              <div>
                <strong>{a.data.author}</strong>
                <span>
                  {a.data.publishedAt &&
                    new Date(a.data.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <ArrowUpRight />
            </div>
          </div>
        </Link>
      )}
      <div className="blog-grid">
        {records.slice(1, 4).map((r) => (
          <Reveal key={r.id}>
            <Link className="article-card" href={`/blog/${r.slug}`}>
              <div className="article-image">
                <Artwork src={r.data.image} alt={r.title} />
              </div>
              <span className="caption">{r.data.category}</span>
              <h3>{r.title}</h3>
              <p>{r.description}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
export function FAQ() {
  const s = useSection("faq"),
    records = useSite().faqs || [];
  const [open, setOpen] = useState<string | null>(null);
  const reduced = useReducedMotion();
  return (
    <section className="soft section">
      <div className="container faq-layout">
        <div>
          <h2>{s?.title || "Frequently asked questions."}</h2>
          <p>{s?.description}</p>
          <div className="faq-list">
            {records.map((r) => (
              <div className="faq-item" key={r.id}>
                <h3>
                  <button
                    aria-expanded={open === r.id}
                    aria-controls={`faq-${r.id}`}
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                  >
                    {r.title}
                    <Plus
                      className={open === r.id ? "rotated" : ""}
                      size={20}
                    />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {open === r.id && (
                    <motion.div
                      id={`faq-${r.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : motionTiming.faq }}
                    >
                      <p>{r.data.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
        <Reveal className="booking-card">
          <div className="booking-art" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h3>{s?.data.bookingTitle || "Big ideas? Let’s talk."}</h3>
          <p>
            {s?.data.bookingDescription ||
              "Tell us what you have in mind. We’ll find the right next step together."}
          </p>
          <Button>{s?.data.bookingLabel || "Book a discovery call"}</Button>
          <Link href="/contact">Or send us a message</Link>
        </Reveal>
      </div>
    </section>
  );
}
export function FinalCTA() {
  const s = useSection("cta");
  if (!s) return null;
  return (
    <section className="container final-cta-wrap">
      <Reveal className="final-cta">
        <h2>{s.title}</h2>
        <p>{s.description}</p>
        <div className="button-row">
          <Button href={s.data.ctaUrl}>{s.data.ctaLabel}</Button>
          {s.data.secondaryUrl && (
            <Button href={s.data.secondaryUrl} secondary>
              {s.data.secondaryLabel}
            </Button>
          )}
        </div>
      </Reveal>
    </section>
  );
}
export function Footer() {
  const site = useSite(),
    settings = site.footer?.[0]?.data;
  const rows = site.navigation?.filter((n) => n.data.placement === "footer");
  const navigation = rows?.length ? rows : site.navigation || [];
  if (settings?.hidden) return null;
  return (
    <footer id="site-footer" data-layout={settings?.layout || "centered"}>
      <div className="container">
        {settings?.logo ? (
          <img
            className="footer-custom-logo"
            src={settings.logo}
            alt="Agency logo"
          />
        ) : (
          <Logo />
        )}
        {settings?.description && (
          <p className="footer-description">{settings.description}</p>
        )}
        {settings?.groups?.length > 0 && (
          <div className="footer-groups">
            {settings.groups.map(
              (
                group: {
                  title: string;
                  links: { label: string; url: string }[];
                },
                i: number,
              ) => (
                <div key={i}>
                  <h3>{group.title}</h3>
                  {group.links?.map((link, j) => (
                    <Link key={j} href={link.url}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ),
            )}
          </div>
        )}
        {settings?.newsletterEnabled && (
          <NewsletterForm title={settings.newsletterTitle} />
        )}
        <nav aria-label="Footer navigation">
          <Link href="/">Home</Link>
          {navigation.map((n) => (
            <Link key={n.id} href={n.data.url || "/"}>
              {n.title}
            </Link>
          ))}
        </nav>
        <div className="social-links">
          {settings?.socialLinks?.map(
            (item: { label: string; url: string }, i: number) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
                <ArrowUpRight size={13} />
              </a>
            ),
          )}
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {settings?.copyright || "Royal Studio"}
          </span>
          <div>
            <Link href={settings?.privacyUrl || "/privacy"}>
              Privacy policy
            </Link>
            <Link href={settings?.termsUrl || "/terms"}>
              Terms & conditions
            </Link>
          </div>
          <span>
            {settings?.tagline?.replace(
              /Independent minds\.\s*Considered design\./gi,
              "",
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}
