import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { CONTACT_TOPIC_LABELS, isContactTopic, replyHref } from "@/lib/contact";
import { db } from "@/lib/db";
import AdminAction from "../AdminAction";
import { Badge, card, focus, Empty, link, LoadError, PageHeader, Section, UserLink, when } from "../ui";

export const metadata = { title: "Inbox" };

interface MessageRow {
  id: number;
  name: string;
  email: string;
  topic: string;
  message: string;
  user_id: string | null;
  status: string;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
}

const COLUMNS = "id, name, email, topic, message, user_id, status, created_at, handled_at, handled_by";
const OPEN_LIMIT = 200;
const HANDLED_LIMIT = 30;

const topicLabel = (t: string) => (isContactTopic(t) ? CONTACT_TOPIC_LABELS[t] : t);

function MessageCard({ m }: { m: MessageRow }) {
  return (
    <li className={`${card} text-[14px]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <strong className="text-[15px] font-semibold">{m.name}</strong>{" "}
          <a href={replyHref(m.email, m.topic)} className={`${link} break-all`}>
            {m.email}
          </a>
          <div className="mt-0.5 text-[13px] text-ink-soft">
            {topicLabel(m.topic)} · <span className="tabular-nums">{when(m.created_at)}</span>
            {m.user_id && (
              <>
                {" · "}
                <UserLink id={m.user_id} />
              </>
            )}
          </div>
        </div>
        <Badge label={m.status} />
      </div>
      {/* Rendered as text (React escapes it); whitespace kept so lists read right. */}
      <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words leading-[1.7]">{m.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <a
          href={replyHref(m.email, m.topic)}
          className={`inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-4 text-[13px] font-semibold text-ink transition-colors hover:border-ink sm:min-h-9 ${focus}`}
        >
          Reply by email
        </a>
        {m.status === "open" ? (
          <AdminAction
            endpoint={`/api/admin/contact/${m.id}`}
            actions={[{ action: "handled", label: "Mark handled", tone: "primary" }]}
          />
        ) : (
          <span className="text-[13px] text-ink-soft">
            Handled <span className="tabular-nums">{when(m.handled_at)}</span>
            {m.handled_by && (
              <>
                {" by "}
                <UserLink id={m.handled_by} />
              </>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

/** Messages from the /contact form: the open queue, then recently handled ones. */
export default async function AdminInbox() {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();

  const [open, handled] = await Promise.all([
    db
      .from("contact_messages")
      .select(COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(OPEN_LIMIT)
      .returns<MessageRow[]>(),
    db
      .from("contact_messages")
      .select(COLUMNS)
      .eq("status", "handled")
      .order("handled_at", { ascending: false })
      .limit(HANDLED_LIMIT)
      .returns<MessageRow[]>(),
  ]);
  const openRows = open.data ?? [];
  const handledRows = handled.data ?? [];

  return (
    <>
      <LoadError errors={[open.error?.message, handled.error?.message]} />
      <PageHeader title="Inbox">
        <p className="mt-3 text-[14px] text-ink-soft">Messages sent through the contact form.</p>
      </PageHeader>
      <Section title="Open messages" count={openRows.length}>
        {openRows.length ? (
          <ul className="space-y-3">
            {openRows.map((m) => (
              <MessageCard key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <Empty>Inbox zero — no open messages.</Empty>
        )}
      </Section>
      <Section title="Recently handled" count={handledRows.length}>
        {handledRows.length ? (
          <ul className="space-y-3">
            {handledRows.map((m) => (
              <MessageCard key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <Empty>Nothing handled yet.</Empty>
        )}
      </Section>
    </>
  );
}
