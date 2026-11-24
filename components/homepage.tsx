"use client";
import { useSite } from "./site-context";
import {
  Hero,
  Gallery,
  Marquee,
  AboutSection,
  PortfolioSection,
  PhotoCTA,
  Impact,
  ServicesSection,
  Testimonials,
  BlogSection,
  FAQ,
  FinalCTA,
} from "./site";
const views: Record<string, React.ComponentType> = {
  hero: Hero,
  gallery: Gallery,
  logos: Marquee,
  about: AboutSection,
  portfolio: PortfolioSection,
  "photo-cta": PhotoCTA,
  impact: Impact,
  services: ServicesSection,
  testimonials: Testimonials,
  blog: BlogSection,
  faq: FAQ,
  cta: FinalCTA,
};
export default function Homepage() {
  const site = useSite();
  return (
    <main id="main">
      {site.sections?.map((s) => {
        const View = views[s.data.kind];
        return View ? <View key={s.id} /> : null;
      })}
    </main>
  );
}
