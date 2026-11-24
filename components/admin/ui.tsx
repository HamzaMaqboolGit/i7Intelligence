"use client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Select from "@radix-ui/react-select";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, X, Inbox, Loader2 } from "lucide-react";
import { cinematicEase } from "@/lib/motion";
export function SelectInput({
  value,
  onChange,
  options,
  label,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  name?: string;
}) {
  return (
    <Select.Root name={name} value={value} onValueChange={onChange}>
      <Select.Trigger className="a-select" aria-label={label}>
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={15} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="a-select-menu"
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                className="a-select-option"
                key={o.value}
                value={o.value}
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
export function Menu({
  trigger,
  children,
  label,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button type="button" className="a-icon-button" aria-label={label}>
          {trigger}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="a-dropdown" sideOffset={10} align="end">
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function MenuItem({
  children,
  onSelect,
  destructive = false,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <Dropdown.Item
      className={`a-menu-item ${destructive ? "danger" : ""}`}
      onSelect={onSelect}
    >
      {children}
    </Dropdown.Item>
  );
}
export function Drawer({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="a-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.section
                className={`a-drawer ${wide ? "wide" : ""}`}
                initial={reduced ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{
                  duration: reduced ? 0 : 0.4,
                  ease: cinematicEase,
                }}
              >
                <header>
                  <Dialog.Title>{title}</Dialog.Title>
                  <Dialog.Close
                    className="a-icon-button"
                    aria-label="Close editor"
                  >
                    <X size={20} />
                  </Dialog.Close>
                </header>
                {children}
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  busy = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  busy?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="a-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="a-confirm"
                initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.35, ease: cinematicEase }}
              >
                <span className="a-confirm-icon">
                  <Inbox />
                </span>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description>{description}</Dialog.Description>
                <div className="a-button-row">
                  <button className="a-button secondary" onClick={onClose}>
                    {cancelLabel}
                  </button>
                  <button
                    className="a-button danger-button"
                    disabled={busy}
                    onClick={onConfirm}
                  >
                    {busy ? (
                      <Loader2 className="spin" size={17} />
                    ) : (
                      confirmLabel
                    )}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Create your first item to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="a-empty">
      <span>
        <Inbox size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="a-skeletons" aria-label="Loading content">
      {[0, 1, 2, 3].map((i) => (
        <div className="a-skeleton" key={i} />
      ))}
    </div>
  );
}
export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`a-badge ${["published", "resolved", "confirmed", "completed", "subscribed"].includes(status) ? "positive" : ["draft", "pending", "unread"].includes(status) ? "pending" : ""}`}
    >
      <i />
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
export function AdminEntrance({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: cinematicEase }}
    >
      {children}
    </motion.div>
  );
}
export function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="a-metric">
      <span className="a-metric-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <svg className="a-metric-wave" viewBox="0 0 150 60" aria-hidden="true">
        <path d="M0 60 Q50 60 80 25 T150 10 V60Z" fill="currentColor" />
      </svg>
    </div>
  );
}
