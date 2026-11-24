import {
  languages,
  timezones,
  dateFormats,
  timeFormats,
} from "@/lib/locale-options";
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma delegates share a runtime-validated registry. */
import { countryCodes } from "@/lib/countries";
import { palettes } from "@/lib/theme";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { modules, Field, slugify } from "./registry";
import { HttpError } from "@/lib/access";
import sanitize from "sanitize-html";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
export type CmsRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  sortOrder: number;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export function delegate(module: string, client: any = prisma): any {
  const config = modules[module];
  if (!config) throw new HttpError(404, "Unknown content collection.");
  return client[config.model];
}
export const safeUrl = (value: string) =>
  !value ||
  (/^\/(?!\/)/.test(value) && !value.includes("\\")) ||
  /^https:\/\//.test(value) ||
  /^mailto:[^\s]+@[^\s]+$/.test(value) ||
  /^tel:[+\d ()-]+$/.test(value);
export function cleanHtml(value: string) {
  return sanitize(value, {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "h4",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "pre",
      "code",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitize.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
function validateFields(fields: Field[], raw: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const field of fields) {
    const value = raw[field.key];
    if (
      field.required &&
      (value === undefined || value === null || value === "")
    )
      throw new HttpError(400, `${field.label} is required.`);
    if (value === undefined || value === null) continue;
    if (field.type === "list") {
      if (!Array.isArray(value) || value.length > 80)
        throw new HttpError(
          400,
          `${field.label} must be a list with at most 80 items.`,
        );
      out[field.key] = value.map((v) => validateFields(field.fields || [], v));
      continue;
    }
    if (field.type === "checkbox") {
      out[field.key] = value === true;
      continue;
    }
    if (field.type === "number") {
      if (value === "") {
        out[field.key] = "";
        continue;
      }
      const number = Number(value);
      if (!Number.isFinite(number))
        throw new HttpError(400, `${field.label} must be a number.`);
      out[field.key] = number;
      continue;
    }
    if (typeof value !== "string" || value.length > 80000)
      throw new HttpError(400, `${field.label} is invalid or too long.`);
    const text = value.trim();
    if (["url", "image"].includes(field.type || "") && !safeUrl(text))
      throw new HttpError(400, `${field.label} must use a safe URL.`);
    if (field.type === "email" && text && !z.email().safeParse(text).success)
      throw new HttpError(400, "Please enter a valid email address.");
    if (field.type === "date" && text && !Number.isFinite(Date.parse(text)))
      throw new HttpError(400, `${field.label} is invalid.`);
    out[field.key] = field.type === "rich" ? cleanHtml(text) : text;
  }
  return out;
}
export function validateRecord(module: string, raw: any) {
  const config = modules[module];
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(250),
      slug: z.string().trim().max(190).optional(),
      description: z.string().max(10000).nullable().optional(),
      status: z.string(),
      sortOrder: z.coerce.number().int().min(0).max(100000),
      data: z.record(z.string(), z.unknown()),
    })
    .safeParse(raw);
  if (!parsed.success)
    throw new HttpError(400, "Check the title, description and display order.");
  const value = parsed.data;
  if (!config.statuses.includes(value.status))
    throw new HttpError(400, "Invalid publication status.");
  const slug = config.singleton || slugify(value.slug || value.title);
  if (!slug) throw new HttpError(400, "Please enter a valid URL slug.");
  const data = validateFields(config.fields, value.data);
  if (module === "clients") {
    data.email = data.email.toLowerCase();
    data.contactName = value.title;
    if (data.permission && !data.company)
      throw new HttpError(
        400,
        "Add the company name before allowing public logo display.",
      );
    if (
      data.phone &&
      (!/^[+\d().\s#x-]{5,40}$/i.test(data.phone) ||
        data.phone.replace(/\D/g, "").length < 5)
    )
      throw new HttpError(
        400,
        "Enter a valid phone number, including country code when needed.",
      );
    if (data.website && !/^https:\/\//i.test(data.website))
      throw new HttpError(400, "Company website must start with https://.");
    if (data.country && !countryCodes.includes(data.country))
      throw new HttpError(400, "Choose a country from the list.");
  }
  if (module === "settings") {
    for (const [key, choices] of Object.entries({
      language: languages,
      timezone: timezones,
      dateFormat: dateFormats,
      timeFormat: timeFormats,
    }))
      if (data[key] && !choices.some((choice) => choice.value === data[key]))
        throw new HttpError(400, `Choose a valid ${key} from the list.`);

    for (const key of ["themeAccent", "websiteThemeAccent", "adminThemeAccent"])
      if (data[key] && !Object.hasOwn(palettes, data[key]))
        throw new HttpError(400, "Invalid theme palette");
    for (const key of ["themeMode", "websiteThemeMode", "adminThemeMode"])
      if (data[key] && !["light", "dark", "system"].includes(data[key]))
        throw new HttpError(400, "Invalid color mode");
  }
  if (module === "store-products") {
    if (!["digital", "service"].includes(data.kind))
      throw new HttpError(400, "Choose digital or service.");
    if (!/^[a-z]{3}$/.test(data.currency || ""))
      throw new HttpError(400, "Use a lowercase ISO currency code.");
    for (const key of ["priceMinor", "salePriceMinor"])
      if (
        data[key] !== undefined &&
        data[key] !== "" &&
        (!Number.isSafeInteger(data[key]) ||
          data[key] < 0 ||
          data[key] > 99999999)
      )
        throw new HttpError(
          400,
          "Prices must be non-negative integer minor units.",
        );
    if (
      data.salePriceMinor !== undefined &&
      data.salePriceMinor !== "" &&
      data.salePriceMinor >= data.priceMinor
    )
      throw new HttpError(400, "Sale price must be below regular price.");
    for (const key of ["downloadDays", "downloadLimit"])
      if (
        data[key] !== undefined &&
        data[key] !== "" &&
        (!Number.isSafeInteger(data[key]) || data[key] < 1 || data[key] > 3650)
      )
        throw new HttpError(
          400,
          "Download limits must be positive integers up to 3650.",
        );
    if (data.packages) {
      const keys = new Set();
      for (const p of data.packages) {
        if (
          !p.key ||
          keys.has(p.key) ||
          !Number.isSafeInteger(p.priceMinor) ||
          p.priceMinor < 0
        )
          throw new HttpError(
            400,
            "Package keys must be unique and prices must be integer minor units.",
          );
        keys.add(p.key);
      }
    }
  }
  if (module === "store-coupons") {
    if (
      !["fixed", "percentage"].includes(data.kind) ||
      !Number.isSafeInteger(data.value) ||
      data.value <= 0 ||
      (data.kind === "percentage" && data.value > 100)
    )
      throw new HttpError(400, "Coupon discount is invalid.");
    data.code = data.code.toUpperCase();
  }
  if (data.structuredData) {
    try {
      const parsed = JSON.parse(data.structuredData);
      if (!parsed || typeof parsed !== "object") throw new Error();
    } catch {
      throw new HttpError(400, "Structured data must be valid JSON.");
    }
  }
  if (module === "footer") {
    for (const key of ["backgroundColor", "textColor"])
      if (data[key] && !/^#[0-9a-f]{6}$/i.test(data[key]))
        throw new HttpError(400, "Footer colors must be six-digit hex values.");
  }
  if (
    module === "navigation" &&
    !["header", "footer", "mobile"].includes(data.placement || "header")
  )
    throw new HttpError(400, "Choose a valid menu.");
  if (module === "pages" && ["admin", "api", "media", "_next"].includes(slug))
    throw new HttpError(400, "That page URL is reserved.");
  if (
    module === "sections" &&
    ![
      "hero",
      "gallery",
      "logos",
      "about",
      "portfolio",
      "photo-cta",
      "impact",
      "services",
      "testimonials",
      "blog",
      "faq",
      "cta",
    ].includes(String(data.kind))
  )
    throw new HttpError(400, "Choose a supported homepage section type.");
  if (
    module === "locations" &&
    (Number(data.latitude) < -90 ||
      Number(data.latitude) > 90 ||
      Number(data.longitude) < -180 ||
      Number(data.longitude) > 180)
  )
    throw new HttpError(
      400,
      "Latitude or longitude is outside its valid range.",
    );
  if (
    module === "testimonials" &&
    value.status === "published" &&
    (!data.permission || Number(data.rating) < 1 || Number(data.rating) > 5)
  )
    throw new HttpError(
      400,
      "Publishing requires a rating from 1 to 5 and permission to publish.",
    );
  if (
    module === "subscribers" &&
    value.status === "subscribed" &&
    !data.consent
  )
    throw new HttpError(400, "Confirmed consent is required.");
  if (
    module === "bookings" &&
    !raw.id &&
    (!data.requestedAt || new Date(data.requestedAt) <= new Date())
  )
    throw new HttpError(400, "Please choose a future preferred time.");
  return {
    ...value,
    slug:
      module === "subscribers"
        ? createHash("sha256")
            .update(String(data.email).toLowerCase())
            .digest("hex")
        : module === "store-coupons"
          ? slugify(String(data.code))
          : slug,
    data: data as Prisma.InputJsonValue,
  };
}
export async function publicRecords(module: string) {
  const rows = await delegate(module).findMany({
    where: {
      status: "published",
      deletedAt: null,
      ...(modules[module].singleton ? { slug: modules[module].singleton } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.filter(
    (r: any) =>
      module !== "blog" ||
      !r.data.publishedAt ||
      new Date(r.data.publishedAt) <= new Date(),
  ) as CmsRecord[];
}
export async function audit(
  tx: any,
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | undefined,
  description: string,
) {
  return tx.activityLog.create({
    data: { userId, action, entity, entityId, description },
  });
}
export async function notify(
  tx: any,
  type: string,
  title: string,
  description: string,
  href: string,
  permission: string,
) {
  const users = await tx.user.findMany({
    where: {
      disabled: false,
      roles: {
        some: {
          role: { permissions: { some: { permission: { key: permission } } } },
        },
      },
    },
    include: { preferences: true },
  });
  const recipients = users.filter(
    (u: any) => u.preferences?.data?.[type] !== false,
  );
  if (!recipients.length) return;
  return tx.notification.create({
    data: {
      type,
      title,
      description,
      href,
      receipts: { create: recipients.map((u: any) => ({ userId: u.id })) },
    },
  });
}
export function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
export async function syncRelations(tx: any, module: string, row: any) {
  if (module === "sections") {
    const home = await tx.page.findUnique({ where: { slug: "home" } });
    if (home)
      await tx.pageSection.update({
        where: { id: row.id },
        data: { pageId: home.id },
      });
  }
  if (module === "portfolio") {
    await tx.portfolioImage.updateMany({
      where: { projectId: row.id, deletedAt: null },
      data: { deletedAt: new Date(), status: "archived" },
    });
    const gallery = row.data.gallery || [];
    if (gallery.length)
      await tx.portfolioImage.createMany({
        data: gallery.map(
          (image: { image: string; alt?: string }, sortOrder: number) => ({
            projectId: row.id,
            title: image.alt || row.title,
            slug: `${row.slug}-${sortOrder}-${randomUUID()}`,
            sortOrder,
            status: row.status,
            data: image,
          }),
        ),
      });
  }
  if (module === "blog" && row.data.category) {
    const slug = slugify(row.data.category);
    const category = await tx.blogCategory.upsert({
      where: { slug },
      update: {},
      create: { slug, title: row.data.category, status: "published", data: {} },
    });
    await tx.blogPost.update({
      where: { id: row.id },
      data: { categoryId: category.id },
    });
  }
}
