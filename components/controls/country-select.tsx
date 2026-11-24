"use client";
import * as Popover from "@radix-ui/react-popover";
import { useRef, useState } from "react";
import { Check, ChevronDown, Search, Globe } from "lucide-react";
import { countryOptions } from "@/lib/countries";
export default function CountrySelect({
  value,
  onChange,
  name = "country",
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const rows = countryOptions.filter((c) =>
    `${c.label} ${c.value}`.toLowerCase().includes(query.toLowerCase()),
  );
  const label = countryOptions.find((c) => c.value === value)?.label;
  function select(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} />
      <Popover.Trigger asChild>
        <button
          type="button"
          className="premium-select-trigger"
          aria-label="Country"
        >
          <Globe size={17} />
          <span>{label || "Select your country"}</span>
          <ChevronDown size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Choose your country"
          className="premium-country-menu"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            input.current?.focus();
          }}
        >
          <div className="country-search">
            <Search size={17} />
            <input
              ref={input}
              role="combobox"
              aria-label="Search countries"
              aria-expanded="true"
              aria-controls="country-options"
              aria-activedescendant={
                rows[active] ? `country-${rows[active].value}` : undefined
              }
              value={query}
              placeholder="Search country or code…"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((v) => Math.min(v + 1, rows.length - 1));
                  document
                    .getElementById(
                      `country-${rows[Math.min(active + 1, rows.length - 1)]?.value}`,
                    )
                    ?.scrollIntoView({ block: "nearest" });
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((v) => Math.max(0, v - 1));
                }
                if (e.key === "Enter" && rows[active]) {
                  e.preventDefault();
                  select(rows[active].value);
                }
              }}
            />
          </div>
          <div
            role="listbox"
            id="country-options"
            aria-label="Countries"
            className="country-options"
          >
            {rows.map((c, i) => (
              <button
                id={`country-${c.value}`}
                type="button"
                role="option"
                aria-selected={value === c.value}
                tabIndex={-1}
                className={active === i ? "highlighted" : ""}
                key={c.value}
                onClick={() => select(c.value)}
              >
                <span>{c.label}</span>
                <small>{c.value}</small>
                {value === c.value && <Check size={15} />}
              </button>
            ))}
            {!rows.length && (
              <p className="country-no-results">No countries found.</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
