"use client";
import DateTimePicker from "../controls/date-time-picker";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/lib/cms/registry";
import type { CmsRecord } from "@/lib/cms/store";
import { Drawer, Empty, SelectInput } from "./ui";
import {
  languages,
  timezones,
  dateFormats,
  timeFormats,
} from "@/lib/locale-options";
const RichEditor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => <div className="a-skeleton" />,
});
export function ImagePicker({
  value,
  onChange,
  label = "Image",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<CmsRecord[]>([]);
  const [busy, setBusy] = useState(false);
  async function choose() {
    setOpen(true);
    try {
      const response = await fetch("/api/admin/media?size=50");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRecords(data.records || []);
    } catch (error) {
      toast.error("Unable to load media", {
        description: error instanceof Error ? error.message : "",
      });
    }
  }
  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/admin/media-upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onChange(data.data.image);
      setOpen(false);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="a-image-picker">
      {value ? (
        <div className="a-image-preview">
          <img src={value} alt={`${label} preview`} />
          <button
            type="button"
            className="a-icon-button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange("")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="a-image-placeholder" onClick={choose}>
          <ImageIcon size={25} />
          <span>Choose an image</span>
        </button>
      )}
      <div className="a-button-row">
        <button
          className="a-button secondary small"
          type="button"
          onClick={choose}
        >
          Media library
        </button>
        <label className="a-button secondary small a-upload-label">
          {busy ? <Loader2 className="spin" size={15} /> : <Upload size={15} />}
          Upload
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              if (e.target.files?.[0]) upload(e.target.files[0]);
            }}
            hidden
          />
        </label>
      </div>
      <input
        aria-label={`${label} URL`}
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste an image URL"
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Choose from your media library"
      >
        <div className="a-drawer-body">
          {records.length ? (
            <div className="a-media-picker-grid">
              {records.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(r.data.image);
                    setOpen(false);
                  }}
                >
                  <img
                    src={r.data.thumbnail || r.data.image}
                    alt={r.data.alt || r.title}
                  />
                  <span>{r.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="No images yet"
              description="Upload an image to begin your library."
            />
          )}
        </div>
      </Drawer>
    </div>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic fields are constrained and validated by the shared schema. */
export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: any;
  onChange: (value: any) => void;
}) {
  const id = `field-${field.key}`;
  const choices = (
    {
      language: languages,
      timezone: timezones,
      dateFormat: dateFormats,
      timeFormat: timeFormats,
    } as Record<string, { value: string; label: string }[]>
  )[field.key];
  if (choices) {
    const selected = String(
      value ||
        (
          {
            language: "en",
            timezone: "UTC",
            dateFormat: "MMM d, yyyy",
            timeFormat: "12",
          } as Record<string, string>
        )[field.key],
    );
    const options = choices.some((o) => o.value === selected)
      ? choices
      : [{ value: selected, label: selected }, ...choices];
    return (
      <label className="a-field">
        <span>{field.label}</span>
        <SelectInput
          value={selected}
          onChange={onChange}
          options={options}
          label={field.label}
        />
      </label>
    );
  }
  if (field.type === "date")
    return (
      <div className="a-field">
        <span>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <DateTimePicker
          label={field.label}
          value={value || ""}
          required={field.required}
          onChange={(v) => onChange(v ? new Date(v).toISOString() : "")}
        />
      </div>
    );
  if (field.type === "rich")
    return (
      <div className="a-field">
        <span>
          {field.label}
          {field.required && " *"}
        </span>
        <RichEditor value={value || ""} onChange={onChange} />
      </div>
    );
  if (field.type === "image")
    return (
      <div className="a-field">
        <span>{field.label}</span>
        <ImagePicker
          value={value || ""}
          onChange={onChange}
          label={field.label}
        />
      </div>
    );
  if (field.type === "list")
    return (
      <div className="a-field a-repeatable">
        <span>{field.label}</span>
        {(value || []).map((row: Record<string, unknown>, i: number) => (
          <div className="a-repeatable-row" key={i}>
            <div className="a-repeatable-heading">
              <strong>Item {i + 1}</strong>
              <div>
                <button
                  type="button"
                  className="a-button secondary small"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...value];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onChange(next);
                  }}
                >
                  Move up
                </button>
                <button
                  className="a-icon-button danger"
                  aria-label={`Remove item ${i + 1}`}
                  type="button"
                  onClick={() =>
                    onChange(value.filter((_: unknown, n: number) => n !== i))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {field.fields?.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={row[f.key]}
                onChange={(v) =>
                  onChange(
                    value.map((r: Record<string, unknown>, n: number) =>
                      n === i ? { ...r, [f.key]: v } : r,
                    ),
                  )
                }
              />
            ))}
          </div>
        ))}
        <button
          className="a-button secondary small"
          type="button"
          onClick={() => onChange([...(value || []), {}])}
        >
          <Plus size={15} />
          Add item
        </button>
      </div>
    );
  if (field.type === "checkbox")
    return (
      <label className="a-checkbox-label">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  return (
    <label className="a-field" htmlFor={id}>
      <span>
        {field.label}
        {field.required && " *"}
      </span>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          value={value || ""}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      ) : (
        <input
          id={id}
          type={
            field.type === "number"
              ? "number"
              : field.type === "email"
                ? "email"
                : "text"
          }
          step={field.type === "number" ? "any" : undefined}
          value={value ?? ""}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
