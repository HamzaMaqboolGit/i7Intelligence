export function emitAdminActionSound(kind: "saved" | "sent" = "saved") {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("admin-action-sound", { detail: { kind } }));
}
