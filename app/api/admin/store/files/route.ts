/* eslint-disable no-control-regex -- Strip control characters from attachment filenames. */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  requireAdmin,
  checkOrigin,
  boundedBody,
  jsonBody,
  HttpError,
} from "@/lib/access";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/cms/store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin("store-products:read", request.headers);
    return NextResponse.json({
      records: await prisma.storeProductFile.findMany({
        where: {
          productId: request.nextUrl.searchParams.get("productId") || "",
          deletedAt: null,
        },
        select: {
          id: true,
          productId: true,
          name: true,
          size: true,
          mime: true,
          version: true,
          createdAt: true,
        },
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  let stored: string | undefined;
  try {
    checkOrigin(request);
    const admin = await requireAdmin("store-products:edit", request.headers);
    const bytes = await boundedBody(request, 27 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: Buffer.from(bytes),
    }).formData();
    const file = form.get("file"),
      productId = String(form.get("productId") || ""),
      version = String(form.get("version") || "1.0").slice(0, 40);
    if (
      !(file instanceof File) ||
      file.size > 25 * 1024 * 1024 ||
      file.size < 4
    )
      throw new HttpError(400, "Choose a ZIP or PDF up to 25 MB.");
    const product = await prisma.storeProduct.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product)
      throw new HttpError(404, "Save the product before uploading files.");
    const body = Buffer.from(await file.arrayBuffer());
    const zip =
        body[0] === 0x50 && body[1] === 0x4b && [3, 5, 7].includes(body[2]),
      pdf = body.subarray(0, 5).toString() === "%PDF-";
    if (!zip && !pdf)
      throw new HttpError(
        400,
        "Only verified ZIP and PDF file signatures are accepted.",
      );
    const directory = path.resolve(
      /* turbopackIgnore: true */
      process.env.STORE_FILE_DIRECTORY || "storage/store-private",
    );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const key = `${randomUUID()}.${zip ? "zip" : "pdf"}`;
    stored = path.join(/* turbopackIgnore: true */ directory, key);
    await writeFile(stored, body, { mode: 0o600, flag: "wx" });
    const name =
      path
        .basename(file.name)
        .replace(/[\x00-\x1f\x7f]/g, "")
        .slice(0, 200) || `download.${zip ? "zip" : "pdf"}`;
    const row = await prisma.$transaction(async (tx) => {
      const row = await tx.storeProductFile.create({
        data: {
          productId,
          storageKey: key,
          name,
          size: body.length,
          mime: zip ? "application/zip" : "application/pdf",
          version,
        },
      });
      await audit(
        tx,
        admin.id,
        "uploaded",
        "store-files",
        row.id,
        "Private product file uploaded",
      );
      return row;
    });
    return NextResponse.json(
      { id: row.id, name: row.name, size: row.size, version: row.version },
      { status: 201 },
    );
  } catch (error) {
    if (stored) await unlink(stored).catch(() => {});
    return apiError(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    checkOrigin(request);
    const admin = await requireAdmin("store-products:delete", request.headers);
    const raw = await jsonBody(request);
    if (typeof raw.id !== "string") throw new HttpError(400, "Select a file.");
    await prisma.$transaction(async (tx) => {
      await tx.storeProductFile.update({
        where: { id: raw.id },
        data: { deletedAt: new Date() },
      });
      await audit(
        tx,
        admin.id,
        "archived",
        "store-files",
        raw.id,
        "File removed from future purchases; historical entitlements retained",
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
