import { PrismaClient } from "@prisma/client";
import { stat } from "node:fs/promises";
import sharp from "sharp";
try {
  process.loadEnvFile(".env.local");
} catch {}
const prisma = new PrismaClient();
async function main() {
  const assets = [
    {
      file: "team.jpg",
      title: "Creative studio collaboration",
      alt: "Illustrative team working together around a table",
    },
    {
      file: "office.jpg",
      title: "Light-filled creative workspace",
      alt: "Modern studio with chairs and plants",
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      file: `art/device-${i}.svg`,
      title: [
        "Folded device",
        "Open laptop",
        "Laptop on a plinth",
        "Phone on stone",
        "Navy device study",
        "Laptop in midnight",
        "Digital product study",
        "Editorial laptop study",
      ][i],
      alt: "Original navy device illustration",
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      file: `art/project-${i}.svg`,
      title: `Original website concept ${i + 1}`,
      alt: "Original concept website mockup",
    })),
  ];
  for (const [i, a] of assets.entries()) {
    const metadata = await sharp(`public/${a.file}`).metadata(),
      info = await stat(`public/${a.file}`);
    await prisma.media.upsert({
      where: { slug: `source-asset-${i}` },
      update: {},
      create: {
        title: a.title,
        slug: `source-asset-${i}`,
        status: "published",
        sortOrder: i,
        data: {
          image: `/${a.file}`,
          thumbnail: `/${a.file}`,
          alt: a.alt,
          caption: "Original or licensed source artwork. See asset provenance.",
          folder: "Website assets",
          mime: `image/${metadata.format}`,
          size: info.size,
          width: metadata.width,
          height: metadata.height,
          uploadedBy: "Project source",
          sourceAsset: true,
        },
      },
    });
  }
  console.log(
    "Original and licensed source assets registered in media library.",
  );
}
main().finally(() => prisma.$disconnect());
