"use client";
import type { CmsRecord } from "@/lib/cms/store";
import { modules } from "@/lib/cms/registry";
import { FieldInput } from "./fields";
import CountrySelect from "../controls/country-select";
export default function ClientFields({
  record,
  onChange,
}: {
  record: Partial<CmsRecord>;
  onChange: (value: Partial<CmsRecord>) => void;
}) {
  const data = record.data || {};
  const change = (key: string, value: unknown) =>
    onChange({ data: { ...data, [key]: value } });
  const field = (key: string) => {
    if (key === "phone")
      return (
        <label key={key} className="a-field">
          <span>Phone number</span>
          <input
            type="tel"
            autoComplete="tel"
            maxLength={40}
            placeholder="+92 300 1234567"
            value={data.phone || ""}
            onChange={(e) => change("phone", e.target.value)}
          />
        </label>
      );
    if (key === "website")
      return (
        <label key={key} className="a-field">
          <span>Company website</span>
          <input
            type="url"
            autoComplete="url"
            placeholder="https://company.com"
            value={data.website || ""}
            onChange={(e) => change("website", e.target.value)}
          />
        </label>
      );
    const field = modules.clients.fields.find((f) => f.key === key)!;
    return (
      <FieldInput
        key={key}
        field={field}
        value={data[key]}
        onChange={(v) => change(key, v)}
      />
    );
  };
  return (
    <div className="client-fields">
      <h3>Client details</h3>
      <p className="a-muted">
        Name and email are required. Contact details and private notes are never
        displayed on the website.
      </p>
      <label className="a-field">
        <span>Client full name *</span>
        <input
          required
          autoComplete="name"
          maxLength={250}
          value={record.title || ""}
          onChange={(e) =>
            onChange({
              title: e.target.value,
              ...(!record.id && !record.slug
                ? { slug: `client-${crypto.randomUUID()}` }
                : {}),
            })
          }
        />
      </label>
      <div className="client-fields-grid">
        {field("email")}
        {field("phone")}
        {field("company")}
        {field("jobTitle")}
      </div>
      {field("website")}
      {field("profileImage")}
      <h3>Address</h3>
      {field("address")}
      <div className="client-fields-grid">
        {field("city")}
        {field("region")}
        {field("postalCode")}
        <div className="a-field">
          <span>Country</span>
          <CountrySelect
            value={data.country || ""}
            onChange={(v) => change("country", v)}
          />
        </div>
      </div>
      <label className="a-field">
        <span>Private notes</span>
        <textarea
          rows={5}
          maxLength={10000}
          value={record.description || ""}
          placeholder="Client requirements, preferences, conversation notes…"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>
      <details className="client-website-options">
        <summary>Website logo display (optional)</summary>
        <p className="a-muted">
          Only an active client’s approved company name and company logo may be
          public. The profile image, address, email, phone and notes remain
          private.
        </p>
        {field("image")}
        {field("permission")}
      </details>
    </div>
  );
}
