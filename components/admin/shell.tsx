"use client";
import { useBranding } from "@/components/theme-provider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  UserRound,
  LayoutDashboard,
  ChartNoAxesCombined,
  FileText,
  Briefcase,
  Layers,
  BookOpen,
  MessageSquare,
  Users,
  CalendarDays,
  HelpCircle,
  Mail,
  Image as ImageIcon,
  Navigation,
  PanelBottom,
  Search,
  MapPin,
  Settings,
  Bell,
  Shield,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Menu as MenuIcon,
  ChevronDown,
  Plus,
  ExternalLink,
  LogOut,
  Command,
  Lock,
} from "lucide-react";
import { modules } from "@/lib/cms/registry";
import { authClient } from "@/lib/auth-client";
import type { Admin } from "@/lib/access";
import { toast } from "sonner";
import { Menu, MenuItem, AdminEntrance, Empty } from "./ui";
const icons: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  analytics: ChartNoAxesCombined,
  pages: FileText,
  sections: Layers,
  portfolio: Briefcase,
  services: Layers,
  blog: BookOpen,
  testimonials: MessageSquare,
  team: Users,
  careers: Briefcase,
  faqs: HelpCircle,
  contacts: Mail,
  bookings: CalendarDays,
  clients: Users,
  subscribers: Mail,
  media: ImageIcon,
  navigation: Navigation,
  footer: PanelBottom,
  seo: Search,
  locations: MapPin,
  settings: Settings,
  notifications: Bell,
  users: Users,
  roles: Shield,
  logs: ScrollText,
  security: Lock,
};
const groups = [
  ["Overview", ["dashboard", "analytics"]],
  [
    "Content management",
    [
      "pages",
      "sections",
      "portfolio",
      "services",
      "blog",
      "testimonials",
      "team",
      "careers",
      "faqs",
    ],
  ],
  ["Business", ["contacts", "bookings", "clients", "subscribers"]],
  [
    "Website",
    ["media", "navigation", "footer", "seo", "locations", "settings"],
  ],
  ["System", ["notifications", "users", "roles", "logs", "security"]],
] as const;
const labels: Record<string, string> = {
  profile: "Settings",
  store: "Digital Store",
  dashboard: "Dashboard",
  analytics: "Analytics",
  notifications: "Notifications",
  users: "Admin users",
  roles: "Roles & permissions",
  logs: "Activity logs",
  security: "Security settings",
};
type Notice = {
  notificationId: string;
  readAt: string | null;
  notification: {
    id: string;
    title: string;
    description: string;
    href: string;
    createdAt: string;
    type: string;
  };
};
export default function AdminShell({
  admin,
  children,
}: {
  admin: Admin;
  children: React.ReactNode;
}) {
  const branding = useBranding();
  const pathname = usePathname();
  const router = useRouter();
  const current = pathname.split("/")[2] || "dashboard";
  const [storeOpen, setStoreOpen] = useState(current === "store");
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<
    { title: string; href: string; group: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [sound, setSound] = useState(false);
  const soundEnabled = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const seenNotifications = useRef<Set<string> | null>(null);
  useEffect(() => {
    const enabled =
      localStorage.getItem("admin-action-sounds") !== "off" &&
      localStorage.getItem(`notification-sound:${admin.id}`) !== "off";
    setSound(enabled);
    soundEnabled.current = enabled;
    const unlock = () => {
      if (!soundEnabled.current || typeof AudioContext === "undefined") return;
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    const actionSound = () => {
      if (!soundEnabled.current || typeof AudioContext === "undefined") return;
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      void ctx.resume().then(() => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(820, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.035, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.21);
      }).catch(() => {});
    };
    window.addEventListener("admin-action-sound", actionSound);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      window.removeEventListener("admin-action-sound", actionSound);
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, [admin.id]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [contactUnread, setContactUnread] = useState(0);
  const [bell, setBell] = useState(false);
  const notificationWrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bell) return;
    const outside = (e: PointerEvent) => {
      if (!notificationWrap.current?.contains(e.target as Node)) setBell(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBell(false);
        notificationWrap.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [bell]);
  const input = useRef<HTMLInputElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    setMobile(false);
    setBell(false);
    setSearch("");
  }, [pathname]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const links = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>("a,button") || [],
      );
    links()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = links(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [mobile]);

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        setBell(false);
        setMobile(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/admin/search?q=${encodeURIComponent(search)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (response.ok) setResults(data.results || []);
      } catch {
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  useEffect(() => {
    if (!admin.permissions.includes("notifications:read")) return;
    let alive = true;
    async function refresh() {
      try {
        const response = await fetch("/api/admin/notifications?size=5");
        if (response.status === 401) {
          toast.warning("Session expired", {
            description: "Please sign in again.",
          });
          router.replace("/admin/login");
          return;
        }
        const data = await response.json();
        if (alive && response.ok) {
          const incoming: Notice[] = data.records;
          const fresh = seenNotifications.current
            ? incoming.filter(
                (n) =>
                  !n.readAt &&
                  !seenNotifications.current!.has(n.notificationId),
              )
            : [];
          seenNotifications.current ??= new Set<string>();
          incoming.forEach((n) =>
            seenNotifications.current!.add(n.notificationId),
          );
          if (fresh.length) {
            const latest = fresh[0].notification;
            toast(latest.title, {
              description:
                fresh.length > 1
                  ? `${fresh.length} new notifications. ${latest.description}`
                  : latest.description,
              icon: <Bell size={18} color="#d92d42" />,
              action: {
                label: "View",
                onClick: () =>
                  router.push(latest.href || "/admin/notifications"),
              },
            });
            if (soundEnabled.current && audio.current?.state === "running") {
              const ctx = audio.current,
                osc = ctx.createOscillator(),
                gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(740, ctx.currentTime);
              osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
              gain.gain.setValueAtTime(0.035, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(
                0.001,
                ctx.currentTime + 0.25,
              );
              osc.start();
              osc.stop(ctx.currentTime + 0.26);
            }
          }
          setNotices(incoming);
          setUnread(data.unread);
          setContactUnread(data.contactUnread || 0);
        }
      } catch {}
    }
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [admin.permissions, router]);
  async function logout(all = false) {
    const result = all
      ? await authClient.revokeSessions()
      : await authClient.signOut();
    if (result.error) {
      toast.error("Unable to sign out", { description: result.error.message });
      return;
    }
    if (all) await authClient.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <div className={`admin-app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <AnimatePresence>
        {mobile && (
          <motion.button
            aria-label="Close sidebar"
            className="a-mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobile(false)}
          />
        )}
      </AnimatePresence>
      <aside
        ref={sidebar}
        id="admin-sidebar"
        aria-label="Administration sidebar"
        className={`a-sidebar ${mobile ? "mobile-open" : ""}`}
      >
        <div className="a-sidebar-brand">
          <Link
            href="/admin"
            className="logo"
            aria-label={`${branding.name} admin home`}
            title={branding.name}
          >
            {branding.darkLogo || branding.logo ? (
              <img
                className="a-sidebar-logo-image"
                src={branding.darkLogo || branding.logo}
                alt=""
              />
            ) : (
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
              </span>
            )}
            <span className="a-sidebar-wordmark">
              {branding.name}
              <small>Agency CMS</small>
            </span>
          </Link>
          <button
            className="a-collapse"
            aria-label={
              mobile
                ? "Close sidebar"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            aria-expanded={mobile || !collapsed}
            aria-controls="admin-sidebar"
            onClick={() => {
              if (window.matchMedia("(max-width: 768px)").matches)
                setMobile(false);
              else setCollapsed(!collapsed);
            }}
          >
            {collapsed && !mobile ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>
        <nav aria-label="Admin navigation">
          {admin.permissions.includes("store:read") && (
            <div className="a-nav-group a-store-nav">
              <button
                type="button"
                className="a-store-toggle"
                aria-expanded={storeOpen}
                aria-controls="digital-store-links"
                onClick={() => setStoreOpen((v) => !v)}
              >
                Digital Store{" "}
                <ChevronDown
                  size={14}
                  style={{
                    transform: storeOpen ? "rotate(180deg)" : undefined,
                    transition: "transform .25s",
                  }}
                />
              </button>
              <AnimatePresence initial={false}>
                {storeOpen && (
                  <motion.div
                    id="digital-store-links"
                    key="store-links"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.28 }}
                    style={{ overflow: "hidden" }}
                  >
                    {[
                      ["", "Overview"],
                      ["products", "Products & services"],
                      ["orders", "Orders"],
                      ["customers", "Customers"],
                      ["payments", "Payments"],
                      ["deliveries", "Digital deliveries"],
                      ["coupons", "Coupons"],
                      ["categories", "Categories"],
                      ["settings", "Store settings"],
                    ].map(([path, label]) => (
                      <Link
                        key={path}
                        href={`/admin/store${path ? "/" + path : ""}`}
                      >
                        <Briefcase size={17} />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {groups.map(([group, items]) => (
            <div className="a-nav-group" key={group}>
              <span>{group}</span>
              {items
                .filter((key) =>
                  admin.permissions.includes(
                    `${key === "dashboard" ? "dashboard" : key === "analytics" ? "analytics" : key}:read`,
                  ),
                )
                .map((key) => {
                  const Icon = icons[key] || FileText;
                  return (
                    <Link
                      title={labels[key] || modules[key]?.label}
                      className={current === key ? "active" : ""}
                      href={key === "dashboard" ? "/admin" : `/admin/${key}`}
                      key={key}
                    >
                      <Icon size={18} />
                      <span>{labels[key] || modules[key]?.label}</span>
                      {key === "contacts" && contactUnread > 0 && (
                        <em>{contactUnread}</em>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <Link href="/" className="a-sidebar-footer" target="_blank">
          <span className="a-site-icon">
            <ExternalLink size={18} />
          </span>
          <span>
            View website<small>Open your public experience</small>
          </span>
        </Link>
      </aside>
      <div className="a-workspace" inert={mobile}>
        <header className="a-topbar">
          <button
            className="a-icon-button a-mobile-toggle"
            aria-label="Open sidebar"
            onClick={() => setMobile(true)}
          >
            <MenuIcon size={22} />
          </button>
          <div className="a-global-search">
            <Search size={17} />
            <input
              ref={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anything…"
              aria-label="Global search"
            />
            <kbd>
              <Command size={11} /> K
            </kbd>
            {search && (
              <div className="a-search-results">
                {searching ? (
                  <p>Searching…</p>
                ) : results.length ? (
                  results.map((r, i) => (
                    <Link key={i} href={r.href} onClick={() => setSearch("")}>
                      <span>{r.title}</span>
                      <small>{r.group}</small>
                    </Link>
                  ))
                ) : (
                  <p>No matching records.</p>
                )}
              </div>
            )}
          </div>
          <div className="a-topbar-actions">
            <Menu
              label="Quick actions"
              trigger={
                <>
                  <Plus size={17} />
                  <span className="a-hide-mobile">New</span>
                  <ChevronDown size={13} />
                </>
              }
            >
              {["portfolio", "blog", "pages"]
                .filter((key) => admin.permissions.includes(`${key}:write`))
                .map((key) => (
                  <MenuItem
                    key={key}
                    onSelect={() => router.push(`/admin/${key}?new=1`)}
                  >
                    New {modules[key].singular.toLowerCase()}
                  </MenuItem>
                ))}
            </Menu>
            {admin.permissions.includes("notifications:read") && (
              <div className="a-notification-wrap" ref={notificationWrap}>
                <button
                  className="a-icon-button a-bell"
                  aria-label="Notifications"
                  aria-expanded={bell}
                  onClick={() => setBell(!bell)}
                >
                  <Bell size={21} />
                  {unread > 0 && <i>{unread > 99 ? "99+" : unread}</i>}
                </button>
                <AnimatePresence>
                  {bell && (
                    <motion.div
                      className="a-notification-preview"
                      initial={reduced ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.4 }}
                    >
                      <header>
                        <strong>Notifications</strong>
                        <span>{unread} unread</span>
                      </header>
                      {notices.length ? (
                        notices.map((n) => (
                          <Link
                            href={n.notification.href || "/admin/notifications"}
                            key={n.notificationId}
                            onClick={async () => {
                              await fetch("/api/admin/notifications", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: n.notificationId }),
                              });
                              setUnread(
                                Math.max(0, unread - (n.readAt ? 0 : 1)),
                              );
                              setBell(false);
                            }}
                          >
                            <span className={!n.readAt ? "a-unread-dot" : ""} />
                            <div>
                              <strong>{n.notification.title}</strong>
                              <p>{n.notification.description}</p>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <Empty
                          title="You’re all caught up"
                          description="New activity will appear here."
                        />
                      )}
                      <button
                        type="button"
                        className="a-notification-sound"
                        aria-pressed={sound}
                        onClick={() => {
                          const next = !sound;
                          setSound(next);
                          soundEnabled.current = next;
                          localStorage.setItem(
                            "admin-action-sounds",
                            next ? "on" : "off",
                          );
                          if (next && typeof AudioContext !== "undefined") {
                            audio.current ??= new AudioContext();
                            void audio.current.resume().catch(() => {});
                          }
                        }}
                      >
                        Notification & action sounds: {sound ? "On" : "Off"}
                      </button>
                      <Link
                        className="a-preview-footer"
                        href="/admin/notifications"
                      >
                        View all notifications
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <div className="a-profile">
              <Menu
                label="Profile menu"
                trigger={
                  <>
                    <span className="a-profile-avatar">
                      {admin.image ? (
                        <img src={admin.image} alt="" />
                      ) : (
                        admin.name
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")
                      )}
                    </span>
                    <span className="a-profile-info">
                      <strong>{admin.name}</strong>
                      <small>{admin.roles.join(", ")}</small>
                    </span>
                    <ChevronDown size={15} />
                  </>
                }
              >
                <MenuItem onSelect={() => router.push("/admin/profile")}>
                  <UserRound size={16} />
                  Settings
                </MenuItem>
                <MenuItem onSelect={() => router.push("/admin/security")}>
                  Security & sessions
                </MenuItem>
                <MenuItem onSelect={() => logout(true)}>
                  Sign out all devices
                </MenuItem>
                <MenuItem onSelect={() => logout()} destructive>
                  <LogOut size={16} /> Sign out
                </MenuItem>
              </Menu>
            </div>
          </div>
        </header>
        <main id="main" className="a-main">
          <div className="a-breadcrumb">
            <Link href="/admin">
              <LayoutDashboard size={13} />
            </Link>
            <span>›</span>
            <span>
              {current === "store"
                ? "Digital Store"
                : modules[current]?.group || "Overview"}
            </span>
            <span>›</span>
            <strong>
              {labels[current] || modules[current]?.label || "Dashboard"}
            </strong>
          </div>
          <AdminEntrance key={pathname}>{children}</AdminEntrance>
        </main>
      </div>
    </div>
  );
}
