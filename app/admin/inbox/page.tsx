import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { CONTACT_TOPIC_LABELS, isContactTopic, replyHref } from "@/lib/contact";
import { db } from "@/lib/db";
import AdminAction from "../AdminAction";
import { Badge, Empty, LoadError, Section, UserLink, when } from "../ui";

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
    <li className="rounded-2xl bg-white/70 p-4 text-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <strong className="text-plum">{m.name}</strong>{" "}
          <a href={replyHref(m.email, m.topic)} className="break-all underline">
            {m.email}
          </a>
          <div className="mt-0.5 text-[12px] text-plum-soft">
            {topicLabel(m.topic)} · {when(m.created_at)}
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
      <p className="mt-3 whitespace-pre-wrap break-words text-plum">{m.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={replyHref(m.email, m.topic)}
          className="rounded-full bg-plum/10 px-4 py-1.5 text-[13px] font-bold text-plum hover:opacity-90"
        >
          Reply by email
        </a>
        {m.status === "open" ? (
          <AdminAction
            endpoint={`/api/admin/contact/${m.id}`}
            actions={[{ action: "handled", label: "Mark handled", tone: "primary" }]}
          />
        ) : (
          <span className="text-[12px] text-plum-soft">
            Handled {when(m.handled_at)}
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
