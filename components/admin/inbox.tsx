"use client";
import DateStamp from "../controls/date-stamp";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Send, Archive, Check, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { emitAdminActionSound } from "@/lib/admin-sound";
import type { CmsRecord } from "@/lib/cms/store";
import RichEditor from "./editor";
import { Badge, Empty, Drawer, SelectInput, Confirm } from "./ui";
type Message = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  authorId: string;
  createdAt: string;
  outbox?: { status: string; recipient: string; lastError: string };
};
type Inquiry = CmsRecord & { conversation: Message[] };
export default function Inbox({ permissions }: { permissions: string[] }) {
  const params = useSearchParams();
  const [records, setRecords] = useState<CmsRecord[]>([]),
    [selected, setSelected] = useState(params.get("edit") || ""),
    [detail, setDetail] = useState<Inquiry | null>(null),
    [status, setStatus] = useState("all"),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [composer, setComposer] = useState(false),
    [body, setBody] = useState(""),
    [subject, setSubject] = useState(""),
    [messageId, setMessageId] = useState(""),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState("reply");
  const [discard, setDiscard] = useState(false);
  const [initial, setInitial] = useState({ body: "", subject: "" });
  const canWrite = permissions.includes("contacts:write");
  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/contacts?size=20&page=${page}&q=${encodeURIComponent(q)}&status=${status === "all" ? "" : status}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords(data.records);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, status, page]);
  const loadDetail = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/inbox?id=${selected}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetail(data.inquiry);
      setError("");
    } catch (e) {
      setDetail(null);
      setError((e as Error).message);
    }
  }, [selected]);
  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);
  async function changeStatus(value: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...detail, status: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Message updated");
      await Promise.all([load(), loadDetail()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(action: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: messageId,
          inquiryId: detail.id,
          subject,
          body,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        action === "send"
          ? "Reply accepted by SMTP"
          : action === "note"
            ? "Internal note saved"
            : "Draft saved",
        {
          description:
            action === "send"
              ? "Final inbox delivery is not confirmed."
              : undefined,
        },
      );
      emitAdminActionSound(action === "send" ? "sent" : "saved");
      setComposer(false);
      await Promise.all([load(), loadDetail()]);
    } catch (e) {
      toast.error("Message could not be sent or saved", {
        description: (e as Error).message,
      });
      await loadDetail();
    } finally {
      setBusy(false);
    }
  }
  function compose(type: string, message?: Message) {
    setInitial({
      body: message?.body || "",
      subject: message?.subject || `Re: ${detail?.title || "Your inquiry"}`,
    });
    setKind(type);
    setBody(message?.body || "");
    setSubject(message?.subject || `Re: ${detail?.title || "Your inquiry"}`);
    setMessageId(message?.id || crypto.randomUUID());
    setComposer(true);
  }
  return (
    <div>
      <div className="a-page-heading">
        <div>
          <h1>Contact Messages</h1>
          <p>Manage inquiries and reply directly from your agency inbox.</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="a-error">
          {error}
          <button
            onClick={() => {
              void load();
              void loadDetail();
            }}
          >
            Retry
          </button>
        </div>
      )}
      <div className="a-inbox">
        <aside className="a-inbox-folders">
          {[
            "all",
            "unread",
            "replied",
            "pending",
            "resolved",
            "archived",
            "spam",
          ].map((s) => (
            <button
              key={s}
              className={s === status ? "active" : ""}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              <Mail size={16} />
              {s === "all"
                ? "All messages"
                : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </aside>
        <section className="a-inbox-list">
          <label className="a-search">
            <Search size={17} />
            <input
              placeholder="Search messages…"
              aria-label="Search messages"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {records.map((r) => (
            <button
              className={`a-inbox-preview ${selected === r.id ? "selected" : ""}`}
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <span className="a-avatar">
                {String(r.data.name || "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span>
                <strong>{r.data.name}</strong>
                <b>{r.title}</b>
                <small>{r.description}</small>
                <small>
                  {<DateStamp value={r.createdAt} />} · {r.status}
                </small>
              </span>
            </button>
          ))}
          {!records.length && (
            <Empty
              title="No messages"
              description="New website inquiries will appear here."
            />
          )}
          <div className="a-button-row">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(total / 20))}
            </span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </section>
        <section className="a-inbox-detail">
          {detail ? (
            <>
              <div className="a-button-row">
                {canWrite && (
                  <>
                    <button
                      disabled={busy}
                      className="a-button secondary"
                      onClick={() => changeStatus("read")}
                    >
                      Mark read
                    </button>
                    <button
                      disabled={busy}
                      className="a-button secondary"
                      onClick={() => changeStatus("resolved")}
                    >
                      <Check size={15} />
                      Resolve
                    </button>
                    <button
                      disabled={busy}
                      className="a-icon-button"
                      aria-label="Archive inquiry"
                      onClick={() => changeStatus("archived")}
                    >
                      <Archive size={17} />
                    </button>
                  </>
                )}
              </div>
              <h2>{detail.title}</h2>
              <p className="a-muted">
                {detail.data.reference || detail.slug} ·{" "}
                {<DateStamp value={detail.createdAt} />}
              </p>
              <div className="a-inbox-sender">
                <span className="a-avatar">
                  {String(detail.data.name).slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{detail.data.name}</strong>
                  <p>{detail.data.email}</p>
                  {detail.data.phone && <p>{detail.data.phone}</p>}
                </div>
                <Badge status={detail.status} />
              </div>
              <p className="a-message-text">{detail.data.message}</p>
              <hr />
              <h3>Conversation history</h3>
              {detail.conversation.map((m) => (
                <article
                  className={`a-conversation ${m.kind === "note" ? "internal" : ""}`}
                  key={m.id}
                >
                  <header>
                    <strong>
                      {m.kind === "note"
                        ? "Internal note"
                        : m.kind === "draft"
                          ? "Draft reply"
                          : "Administrator reply"}
                    </strong>
                    <small>{<DateStamp value={m.createdAt} />}</small>
                  </header>
                  <p>{m.subject}</p>
                  <div dangerouslySetInnerHTML={{ __html: m.body }} />
                  {m.outbox && (
                    <>
                      <small>To: {m.outbox.recipient}</small>
                      <Badge status={m.outbox.status} />
                      {m.outbox.lastError && (
                        <p role="status">{m.outbox.lastError}</p>
                      )}
                    </>
                  )}
                  {(m.kind === "draft" ||
                    m.outbox?.status === "pending" ||
                    m.outbox?.status === "failed") &&
                    canWrite && (
                      <button
                        className="a-button secondary reply-edit-unsent"
                        onClick={() => compose("reply", m)}
                      >
                        Edit unsent reply
                      </button>
                    )}
                </article>
              ))}
              {!detail.conversation.length && (
                <p className="a-muted">No replies or internal notes yet.</p>
              )}
              <p className="a-inline-notice">
                Incoming email synchronization is unavailable. Replies sent here
                are recorded; external customer replies require an inbound email
                integration.
              </p>
              {canWrite && (
                <div className="a-button-row">
                  <button className="a-button" onClick={() => compose("reply")}>
                    <Send size={16} />
                    Reply
                  </button>
                  <button
                    className="a-button secondary"
                    onClick={() => compose("note")}
                  >
                    <FileText size={16} />
                    Internal note
                  </button>
                  <SelectInput
                    label="Message status"
                    value={detail.status}
                    onChange={changeStatus}
                    options={[
                      "unread",
                      "read",
                      "replied",
                      "pending",
                      "resolved",
                      "archived",
                      "spam",
                    ].map((value) => ({ value, label: value }))}
                  />
                </div>
              )}
            </>
          ) : (
            <Empty
              title="Select an inquiry"
              description="Read the conversation and reply from this panel."
            />
          )}
        </section>
      </div>
      <Confirm
        open={discard}
        onClose={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          setComposer(false);
        }}
        title="Discard unsaved changes?"
        description="Your saved draft will remain available. Changes made in this composer will be discarded."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
      />
      <Drawer
        open={composer}
        onClose={() => {
          if (body !== initial.body || subject !== initial.subject) {
            setDiscard(true);
            return;
          }
          setComposer(false);
        }}
        title={kind === "note" ? "Internal note" : "Compose reply"}
        wide
      >
        <div className="a-form reply-composer">
          <label className="reply-recipient">
            <span>To</span>
            <input
              readOnly
              value={
                kind === "note"
                  ? "Internal · visible to authorized administrators"
                  : String(detail?.data.email || "")
              }
            />
          </label>
          <label className="reply-subject">
            <span>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <RichEditor key={messageId} value={body} onChange={setBody} />
          <div className="a-button-row">
            {kind === "reply" && (
              <button
                disabled={busy}
                className="a-button secondary"
                onClick={() => save("draft")}
              >
                Save draft
              </button>
            )}
            <button
              disabled={busy}
              className="a-button"
              onClick={() => save(kind === "note" ? "note" : "send")}
            >
              {busy ? "Working…" : kind === "note" ? "Save note" : "Send reply"}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
