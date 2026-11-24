import type { CmsRecord } from "@/lib/cms/store";
export default function StructuredData({ record }: { record?: CmsRecord }) {
  if (!record?.data.structuredData) return null;
  try {
    const data = JSON.parse(record.data.structuredData);
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
    );
  } catch {
    return null;
  }
}
