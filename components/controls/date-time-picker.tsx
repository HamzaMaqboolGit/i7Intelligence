"use client";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { SelectInput } from "../admin/ui";
const pad = (n: number) => String(n).padStart(2, "0");
export function localDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export default function DateTimePicker({
  value,
  onChange,
  name,
  label = "Date and time",
  required = false,
  dateOnly = false,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
  label?: string;
  required?: boolean;
  dateOnly?: boolean;
  min?: string;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(() => {
      const d = value ? new Date(value) : new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
  const selected = value ? new Date(value) : null;
  const hour = selected && !isNaN(+selected) ? pad(selected.getHours()) : "10",
    minute = selected && !isNaN(+selected) ? pad(selected.getMinutes()) : "00";
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function choose(day: number, h = hour, m = minute) {
    const d = new Date(
      month.getFullYear(),
      month.getMonth(),
      day,
      Number(h),
      Number(m),
    );
    onChange(dateOnly ? localDateValue(d).slice(0, 10) : localDateValue(d));
    if (dateOnly) setOpen(false);
  }
  function time(h: string, m: string) {
    const d = selected && !isNaN(+selected) ? selected : new Date();
    d.setHours(Number(h), Number(m));
    onChange(localDateValue(d));
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input
        type="text"
        className="control-validation-input"
        tabIndex={-1}
        aria-label={`${label} value`}
        readOnly
        name={name}
        required={required}
        value={value}
        onInvalid={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      />
      <Popover.Trigger asChild>
        <button
          type="button"
          className="premium-select-trigger date-time-trigger"
          aria-label={label}
        >
          <CalendarDays size={18} />
          <span>
            {selected && !isNaN(+selected)
              ? selected.toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }) +
                (dateOnly
                  ? ""
                  : ` · ${selected.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`)
              : dateOnly
                ? "Choose a date"
                : "Choose date & time"}
          </span>
          <ChevronRight size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          className="premium-calendar"
          align="start"
          sideOffset={8}
          collisionPadding={16}
        >
          <header>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={17} />
            </button>
            <strong>
              {month.toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={17} />
            </button>
          </header>
          <div className="calendar-grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d}>{d}</span>
            ))}
            {Array.from({ length: first }, (_, i) => (
              <i key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1,
                d = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  day,
                  23,
                  59,
                ),
                disabled = min ? d < new Date(min) : false;
              return (
                <button
                  type="button"
                  key={day}
                  disabled={disabled}
                  aria-label={new Date(
                    month.getFullYear(),
                    month.getMonth(),
                    day,
                  ).toLocaleDateString("en", { dateStyle: "full" })}
                  aria-pressed={
                    !!selected && selected.toDateString() === d.toDateString()
                  }
                  onClick={() => choose(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {!dateOnly && (
            <div className="calendar-time">
              <Clock size={17} />
              <SelectInput
                label="Hour"
                value={hour}
                onChange={(h) => time(h, minute)}
                options={Array.from({ length: 24 }, (_, i) => ({
                  value: pad(i),
                  label: pad(i),
                }))}
              />
              <span>:</span>
              <SelectInput
                label="Minute"
                value={minute}
                onChange={(m) => time(hour, m)}
                options={Array.from({ length: 60 }, (_, i) => ({
                  value: pad(i),
                  label: pad(i),
                }))}
              />
              <span className="calendar-local">Local time</span>
            </div>
          )}
          <div className="calendar-footer">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
