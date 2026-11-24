import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  checkOrigin,
  HttpError,
  boundedBody,
} from "@/lib/access";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit, notify, serialize } from "@/lib/cms/store";
import sharp from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  try {
    checkOrigin(request);
    const admin = await requireAdmin("media:write", request.headers);
    userId = admin.id;
    if (Number(request.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      throw new HttpError(413, "Images must be smaller than 10 MB.");
    const bytesBody = await boundedBody(request, 11 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: bytesBody,
    }).formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 10 * 1024 * 1024 ||
      file.size === 0
    )
      throw new HttpError(400, "Choose an image smaller than 10 MB.");
    const allowed: Record<string, string> = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    if (!allowed[file.type])
      throw new HttpError(
        400,
        "Use a JPEG, PNG, WebP or GIF image. SVG and executable uploads are not accepted.",
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    let metadata;
    try {
      metadata = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
    } catch {
      throw new HttpError(400, "The file does not contain a supported image.");
    }
    if (metadata.format !== allowed[file.type])
      throw new HttpError(
        400,
        "The image content does not match its declared file type.",
      );
    const id = randomUUID(),
      filename = `${id}.webp`,
      thumb = `${id}-thumb.webp`;
    const directory = path.resolve(
      /* turbopackIgnore: true */ process.env.MEDIA_DIRECTORY ||
        path.join(process.cwd(), "storage", "media"),
    );
    await mkdir(directory, { recursive: true });
    const optimized = await sharp(bytes, { limitInputPixels: 40000000 })
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    const outputMetadata = await sharp(optimized).metadata();
    const thumbnail = await sharp(bytes, { limitInputPixels: 40000000 })
      .rotate()
      .resize({
        width: 480,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
    await writeFile(path.join(directory, filename), optimized, { mode: 0o644 });
    await writeFile(path.join(directory, thumb), thumbnail, { mode: 0o644 });
    try {
      const record = await prisma.$transaction(async (tx) => {
        const row = await tx.media.create({
          data: {
            title:
              file.name.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 150) ||
              "Uploaded image",
            slug: id,
            status: "published",
            data: {
              image: `/media/${filename}`,
              thumbnail: `/media/${thumb}`,
              filename,
              mime: "image/webp",
              size: optimized.length,
              width: outputMetadata.width,
              height: outputMetadata.height,
              alt: "",
              caption: "",
              folder: "Library",
              uploadedBy: admin.name,
            },
          },
        });
        await audit(
          tx,
          admin.id,
          "uploaded",
          "media",
          row.id,
          `Image uploaded: ${row.title}`,
        );
        return row;
      });
      return NextResponse.json(serialize(record), { status: 201 });
    } catch (error) {
      await Promise.all([
        unlink(path.join(directory, filename)).catch(() => {}),
        unlink(path.join(directory, thumb)).catch(() => {}),
      ]);
      throw error;
    }
  } catch (error) {
    if (userId)
      await prisma
        .$transaction(async (tx) => {
          await notify(
            tx,
            "media",
            "Image upload failed",
            error instanceof HttpError
              ? error.message
              : "An upload could not be saved.",
            "/admin/media",
            "media:read",
          );
        })
        .catch(() => {});
    return apiError(error);
  }
}
