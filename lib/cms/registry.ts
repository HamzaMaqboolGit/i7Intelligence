export type FieldType =
  | "text"
  | "textarea"
  | "rich"
  | "image"
  | "url"
  | "email"
  | "number"
  | "date"
  | "checkbox"
  | "list";
export type Field = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  fields?: Field[];
  help?: string;
};
export type ModuleConfig = {
  label: string;
  singular: string;
  group: string;
  model: string;
  fields: Field[];
  statuses: string[];
  imageKey?: string;
  singleton?: string;
  readOnly?: boolean;
};
const f = (
  key: string,
  label: string,
  type: FieldType = "text",
  required = false,
): Field => ({ key, label, type, required });
const seo = [
  f("seoTitle", "SEO title"),
  f("seoDescription", "SEO description", "textarea"),
  f("focusKeywords", "Focus keywords"),
  f("canonical", "Canonical URL", "url"),
  f("noindex", "Prevent search indexing", "checkbox"),
  f("nofollow", "Prevent link following", "checkbox"),
  f("ogTitle", "Open Graph title"),
  f("ogDescription", "Open Graph description", "textarea"),
  f("ogImage", "Social preview image", "image"),
  f("twitterCard", "Twitter/X card (summary/summary_large_image)"),
  f("structuredData", "Structured data (JSON-LD)", "textarea"),
];
const image = f("image", "Featured image", "image");
const social: Field = {
  key: "socialLinks",
  label: "Social profiles",
  type: "list",
  fields: [f("label", "Platform"), f("url", "Profile URL", "url")],
};
const published = ["draft", "published", "archived"];
const module = (
  label: string,
  singular: string,
  group: string,
  model: string,
  fields: Field[],
  extra: Partial<ModuleConfig> = {},
): ModuleConfig => ({
  label,
  singular,
  group,
  model,
  fields,
  statuses: published,
  ...extra,
});
export const modules: Record<string, ModuleConfig> = {
  "store-settings": module(
    "Store settings",
    "Store settings",
    "Digital store",
    "siteSetting",
    [
      f("storeName", "Store name"),
      f("email", "Store email", "email"),
      f("description", "Store description", "textarea"),
      f("currency", "Default currency"),
      f("currencies", "Supported currencies (comma-separated)"),
      f("orderPrefix", "Order prefix"),
      f("termsUrl", "Terms URL", "url"),
      f("privacyUrl", "Privacy URL", "url"),
      f("downloadDays", "Default link expiration (days)", "number"),
      f("downloadLimit", "Default maximum downloads", "number"),
      f("emailDelivery", "Enable delivery emails", "checkbox"),
      f(
        "serviceInstructions",
        "Default service requirement instructions",
        "textarea",
      ),
    ],
    { singleton: "store" },
  ),
  "store-products": module(
    "Products & services",
    "Product",
    "Digital store",
    "storeProduct",
    [
      f("kind", "Type (digital/service)", "text", true),
      f("sku", "SKU"),
      f("category", "Category"),
      f("tags", "Tags"),
      image,
      {
        key: "gallery",
        label: "Image gallery",
        type: "list",
        fields: [f("image", "Image", "image"), f("alt", "Description")],
      },
      f("body", "Description", "rich"),
      f("currency", "Currency (lowercase ISO)", "text", true),
      f("priceMinor", "Regular price (integer minor units)", "number", true),
      f("salePriceMinor", "Sale price (minor units)", "number"),
      f("saleStart", "Sale starts", "date"),
      f("saleEnd", "Sale ends", "date"),
      {
        key: "packages",
        label: "Licenses / packages",
        type: "list",
        fields: [
          f("key", "Unique key"),
          f("title", "Name"),
          f("priceMinor", "Price (minor units)", "number"),
          f("terms", "Usage terms", "textarea"),
        ],
      },
      f("features", "Features (one per line)", "textarea"),
      f("included", "What's included", "textarea"),
      f("requirements", "Requirements", "textarea"),
      f("turnaround", "Estimated turnaround"),
      f("revisions", "Revision policy"),
      f("license", "Default license terms", "textarea"),
      f("fulfillment", "Fulfillment (automatic/manual)"),
      f("downloadDays", "Download expiration (days)", "number"),
      f("downloadLimit", "Maximum downloads", "number"),
      f("instructions", "Installation instructions", "textarea"),
      f("featured", "Featured", "checkbox"),
      ...seo,
    ],
    { imageKey: "image" },
  ),
  "store-categories": module(
    "Store categories",
    "Category",
    "Digital store",
    "storeCategory",
    [image, ...seo],
    { imageKey: "image" },
  ),
  "store-coupons": module("Coupons", "Coupon", "Digital store", "storeCoupon", [
    f("code", "Coupon code", "text", true),
    f("kind", "Discount type (fixed/percentage)", "text", true),
    f("value", "Discount value (minor units or percent)", "number", true),
    f("currency", "Currency for fixed discounts"),
    f("startsAt", "Valid from", "date"),
    f("expiresAt", "Expires", "date"),
    f("maximumUses", "Maximum uses", "number"),
    f("perCustomer", "Maximum uses per customer", "number"),
    f("minimumMinor", "Minimum subtotal (minor units)", "number"),
    f("products", "Applicable product IDs (comma-separated)"),
    f("categories", "Applicable categories (comma-separated)"),
  ]),
  pages: module("Pages", "Page", "Content management", "page", [
    f("body", "Page content", "rich"),
    f("formHeading", "Contact heading"),
    f("formDescription", "Contact description", "textarea"),
    f("bookingHeading", "Booking heading"),
    f("bookingDescription", "Booking description", "textarea"),
    ...seo,
  ]),
  sections: module(
    "Homepage sections",
    "Section",
    "Content management",
    "pageSection",
    [
      f("kind", "Section type"),
      f("bookingTitle", "FAQ booking card title"),
      f("bookingDescription", "FAQ booking card copy", "textarea"),
      f("bookingLabel", "FAQ booking button label"),
      f("eyebrow", "Eyebrow"),
      f("body", "Supporting copy", "textarea"),
      f("ctaLabel", "Primary button text"),
      f("ctaUrl", "Primary button URL", "url"),
      f("secondaryLabel", "Secondary button text"),
      f("secondaryUrl", "Secondary button URL", "url"),
      image,
      {
        key: "items",
        label: "Section items",
        type: "list",
        fields: [
          f("title", "Title"),
          f("description", "Description", "textarea"),
          f("image", "Image", "image"),
          f("url", "Link", "url"),
          f("value", "Value", "number"),
        ],
      },
    ],
  ),
  portfolio: module(
    "Portfolio",
    "Project",
    "Content management",
    "portfolioProject",
    [
      f("category", "Category"),
      f("client", "Client"),
      f("year", "Project year", "number"),
      image,
      {
        key: "gallery",
        label: "Project gallery",
        type: "list",
        fields: [f("image", "Image", "image"), f("alt", "Image description")],
      },
      f("body", "Project story", "rich"),
      f("projectUrl", "Project URL", "url"),
      f("featured", "Featured project", "checkbox"),
      ...seo,
    ],
    { imageKey: "image" },
  ),
  services: module(
    "Services",
    "Service",
    "Content management",
    "service",
    [f("body", "Full description", "rich"), f("icon", "Icon name"), image],
    { imageKey: "image" },
  ),
  blog: module(
    "Blog",
    "Article",
    "Content management",
    "blogPost",
    [
      f("body", "Article content", "rich", true),
      image,
      f("author", "Author"),
      f("category", "Category"),
      f("tags", "Tags (comma separated)"),
      f("publishedAt", "Publication date", "date"),
      f("featured", "Featured article", "checkbox"),
      ...seo,
    ],
    { imageKey: "image" },
  ),
  categories: module(
    "Blog categories",
    "Category",
    "Content management",
    "blogCategory",
    [],
  ),
  testimonials: module(
    "Testimonials",
    "Testimonial",
    "Content management",
    "testimonial",
    [
      f("role", "Role"),
      f("company", "Company"),
      f("rating", "Rating (1–5)", "number"),
      f("review", "Review", "textarea", true),
      f("image", "Avatar", "image"),
      f("permission", "Permission to publish confirmed", "checkbox"),
    ],
    { imageKey: "image" },
  ),
  team: module(
    "Team members",
    "Team member",
    "Content management",
    "teamMember",
    [
      f("position", "Position"),
      f("biography", "Biography", "rich"),
      f("image", "Photo", "image"),
      social,
    ],
    { imageKey: "image" },
  ),
  careers: module("Careers", "Job opening", "Content management", "career", [
    f("department", "Department"),
    f("location", "Location"),
    f("jobType", "Job type"),
    f("body", "Job description", "rich"),
    f("applicationUrl", "Application URL", "url"),
    f("applicationEmail", "Application email", "email"),
  ]),
  faqs: module("FAQs", "FAQ", "Content management", "faq", [
    f("answer", "Answer", "textarea", true),
    f("category", "Category"),
  ]),
  contacts: module(
    "Contact messages",
    "Message",
    "Business",
    "contactMessage",
    [
      f("name", "Name", "text", true),
      f("email", "Email", "email", true),
      f("service", "Subject"),
      f("message", "Message", "textarea", true),
    ],
    {
      statuses: [
        "unread",
        "read",
        "replied",
        "pending",
        "resolved",
        "archived",
        "spam",
      ],
    },
  ),
  bookings: module(
    "Booking requests",
    "Booking request",
    "Business",
    "bookingRequest",
    [
      f("name", "Contact name", "text", true),
      f("email", "Email", "email", true),
      f("phone", "Phone"),
      f("service", "Service"),
      f("requestedAt", "Preferred date & time", "date", true),
      f("timezone", "Timezone"),
      f("message", "Notes", "textarea"),
    ],
    { statuses: ["pending", "confirmed", "completed", "cancelled"] },
  ),
  clients: module(
    "Clients",
    "Client",
    "Business",
    "client",
    [
      f("email", "Email address", "email", true),
      f("phone", "Phone number"),
      f("company", "Company / organization"),
      f("jobTitle", "Job title / role"),
      f("website", "Company website", "url"),
      f("profileImage", "Profile image", "image"),
      f("address", "Street address", "textarea"),
      f("city", "City"),
      f("region", "State / province"),
      f("postalCode", "Postal code"),
      f("country", "Country"),
      f("contactName", "Legacy contact name"),
      f("image", "Company logo", "image"),
      f(
        "permission",
        "Permission to display company name and logo publicly",
        "checkbox",
      ),
    ],
    { imageKey: "image" },
  ),
  subscribers: module(
    "Newsletter subscribers",
    "Subscriber",
    "Business",
    "newsletterSubscriber",
    [
      f("email", "Email", "email", true),
      f("consent", "Subscription consent confirmed", "checkbox"),
    ],
    { statuses: ["subscribed", "unsubscribed"] },
  ),
  media: module(
    "Media library",
    "Media",
    "Website",
    "media",
    [
      f("image", "Image", "image"),
      f("alt", "Alt text"),
      f("caption", "Caption"),
      f("folder", "Folder"),
    ],
    { imageKey: "image" },
  ),
  navigation: module(
    "Navigation",
    "Navigation item",
    "Website",
    "navigationItem",
    [
      f("url", "Link URL", "url", true),
      f("placement", "Menu (header/footer/mobile)"),
      f("newTab", "Open in new tab", "checkbox"),
      f("icon", "Icon"),
      f("parent", "Parent label"),
    ],
  ),
  footer: module(
    "Footer",
    "Footer settings",
    "Website",
    "siteSetting",
    [
      f("copyright", "Copyright"),
      f("logo", "Footer logo", "image"),
      f("description", "Short description", "textarea"),
      f("hidden", "Hide footer", "checkbox"),
      f("backgroundColor", "Background color"),
      f("textColor", "Text color"),
      f("layout", "Layout (centered/columns)"),
      f("privacyUrl", "Privacy policy URL", "url"),
      f("termsUrl", "Terms URL", "url"),
      {
        key: "groups",
        label: "Footer link groups",
        type: "list",
        fields: [
          f("title", "Group title"),
          {
            key: "links",
            label: "Links",
            type: "list",
            fields: [f("label", "Label"), f("url", "URL", "url")],
          },
        ],
      },
      f("tagline", "Tagline"),
      f("newsletterEnabled", "Show newsletter signup", "checkbox"),
      f("newsletterTitle", "Newsletter heading"),
      social,
    ],
    { singleton: "footer" },
  ),
  seo: module(
    "SEO manager",
    "SEO defaults",
    "Website",
    "siteSetting",
    [...seo],
    { singleton: "seo" },
  ),
  locations: module("Map & locations", "Location", "Website", "location", [
    f("address", "Street address"),
    f("city", "City"),
    f("country", "Country"),
    f("latitude", "Latitude", "number", true),
    f("longitude", "Longitude", "number", true),
    f("email", "Email", "email"),
    f("phone", "Phone"),
    f("primary", "Primary office", "checkbox"),
    f("hours", "Business hours", "textarea"),
    f("mapsUrl", "Directions URL", "url"),
  ]),
  settings: module(
    "Site settings",
    "Site settings",
    "Website",
    "siteSetting",
    [
      f("websiteThemeAccent", "Website accent"),
      f("websiteThemeMode", "Website appearance"),
      f("adminThemeAccent", "Admin accent"),
      f("adminThemeMode", "Admin appearance"),
      f("themeAccent", "Accent palette"),
      f("themeMode", "Color mode"),
      f("agencyName", "Website name", "text", true),
      f("tagline", "Tagline"),
      f("description", "Site description", "textarea"),
      f("language", "Language"),
      f("timezone", "Timezone"),
      f("dateFormat", "Date format"),
      f("timeFormat", "Time format"),
      f("darkLogo", "Dark logo", "image"),
      f("sharingImage", "Social sharing image", "image"),
      f("secondaryLabel", "Header secondary button label"),
      f("secondaryUrl", "Header secondary button URL", "url"),
      f("logo", "Logo", "image"),
      f("favicon", "Favicon", "image"),
      f("email", "Email", "email"),
      f("phone", "Phone"),
      f("address", "Address"),
      f("bookingUrl", "Booking URL", "url"),
      f("ctaLabel", "CTA label"),
      social,
    ],
    { singleton: "general" },
  ),
};
export const publicModules = [
  "pages",
  "sections",
  "portfolio",
  "services",
  "blog",
  "categories",
  "testimonials",
  "team",
  "careers",
  "faqs",
  "clients",
  "navigation",
  "footer",
  "seo",
  "locations",
  "settings",
];
export const contentModules = [
  "pages",
  "sections",
  "portfolio",
  "services",
  "blog",
  "categories",
  "testimonials",
  "team",
  "careers",
  "faqs",
  "media",
];
export const permissionKeys = Object.keys(modules)
  .flatMap((key) => [
    `${key}:read`,
    `${key}:write`,
    `${key}:create`,
    `${key}:edit`,
    `${key}:publish`,
    `${key}:delete`,
  ])
  .concat([
    "dashboard:read",
    "analytics:read",
    "notifications:read",
    "users:read",
    "users:write",
    "roles:read",
    "roles:write",
    "logs:read",
    "security:read",
    "store:read",
    "store:write",
    "store:refund",
  ]);
export function rolePermissions(name: string) {
  if (name === "Super Admin") return permissionKeys;
  if (name === "Admin")
    return permissionKeys.filter(
      (k) => !k.startsWith("roles:") && !k.startsWith("users:write"),
    );
  if (name === "Editor")
    return [
      "dashboard:read",
      "notifications:read",
      "security:read",
      ...contentModules.flatMap((k) => [
        `${k}:read`,
        `${k}:write`,
        `${k}:create`,
        `${k}:edit`,
        `${k}:publish`,
        `${k}:delete`,
      ]),
    ];
  return [
    "dashboard:read",
    "security:read",
    ...contentModules.map((k) => `${k}:read`),
  ];
}
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}
