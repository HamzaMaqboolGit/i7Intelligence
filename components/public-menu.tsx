"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { CmsRecord } from "@/lib/cms/store";
function HoverMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointerInteraction = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Dropdown.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && pointerInteraction.current) {
          requestAnimationFrame(() => {
            const active = document.activeElement;
            if (active instanceof HTMLElement && active.classList.contains("public-menu-trigger")) active.blur();
            pointerInteraction.current = false;
          });
        }
      }}
    >
      <span
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") {
            pointerInteraction.current = true;
            clearTimeout(timer.current);
            setOpen(true);
          }
        }}
        onPointerLeave={() => {
          timer.current = setTimeout(() => setOpen(false), 180);
        }}
      >
        {children}
      </span>
    </Dropdown.Root>
  );
}
export default function PublicMenu({
  rows,
  onNavigate,
}: {
  rows: CmsRecord[];
  onNavigate: () => void;
}) {
  const top = rows.filter((r) => !r.data.parent);
  return (
    <>
      {top.map((r) => {
        const children = rows.filter((c) => c.data.parent === r.title);
        return children.length ? (
          <HoverMenu key={r.id}>
            <Dropdown.Trigger asChild>
              <button type="button" className="public-menu-trigger">
                {r.title}
                <ChevronDown size={13} />
              </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                className="public-dropdown-content"
                align="start"
                sideOffset={12}
                collisionPadding={16}
                aria-label={`${r.title} navigation`}
              >
                <Dropdown.Item asChild>
                  <Link
                    href={r.data.url || "/"}
                    className="public-dropdown-item"
                    onClick={onNavigate}
                  >
                    {r.title}
                  </Link>
                </Dropdown.Item>
                {children.map((c) => (
                  <Dropdown.Item key={c.id} asChild>
                    <Link
                      className="public-dropdown-item"
                      href={c.data.url || "/"}
                      target={c.data.newTab ? "_blank" : undefined}
                      rel={c.data.newTab ? "noopener noreferrer" : undefined}
                      onClick={onNavigate}
                    >
                      {c.title}
                    </Link>
                  </Dropdown.Item>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </HoverMenu>
        ) : (
          <Link
            key={r.id}
            href={r.data.url || "/"}
            target={r.data.newTab ? "_blank" : undefined}
            rel={r.data.newTab ? "noopener noreferrer" : undefined}
            onClick={onNavigate}
          >
            {r.title}
          </Link>
        );
      })}
    </>
  );
}
