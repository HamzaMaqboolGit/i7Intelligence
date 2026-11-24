import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  try {
    const { file } = await params;
    if (!/^[a-f0-9-]{36}(-thumb)?\.webp$/.test(file))
      return new NextResponse(null, { status: 404 });
    const slug = file.replace(/(-thumb)?\.webp$/, "");
    const media = await prisma.media.findFirst({
      where: { slug, status: "published", deletedAt: null },
    });
    if (!media) return new NextResponse(null, { status: 404 });
    const buffer = await readFile(
      /* turbopackIgnore: true */ path.join(
        path.resolve(
          /* turbopackIgnore: true */ process.env.MEDIA_DIRECTORY ||
            path.join(process.cwd(), "storage", "media"),
        ),
        file,
      ),
    );
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
