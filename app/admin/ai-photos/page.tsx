import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { resultImageUrl, type AiPhotoRow } from "@/lib/ai-photos";
import { db } from "@/lib/db";
import AdminAction from "../AdminAction";
import { Badge, card, Empty, LoadError, PageHeader, Section, UserLink, when } from "../ui";
import AiPhotoTools from "./AiPhotoTools";

export const metadata = { title: "AI photos" };

type Row = AiPhotoRow & { completed_by: string | null };
const COLUMNS =
  "id, user_id, design_name, place, prompt, input_path, result_path, status, admin_note, created_at, completed_at, completed_by";
const PENDING_LIMIT = 100;
const RECENT_LIMIT = 30;

// Plain <img>: private, auth-checked pictures from our own route, not for the image optimiser.
const Picture = ({ src, alt }: { src: string; alt: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} loading="lazy" className="w-full rounded-[5px] border border-line bg-paper" />
);

function RequestCard({ r, canGenerate }: { r: Row; canGenerate: boolean }) {
  const pending = r.status === "pending";
  return (
    <li className={`${card} text-[14px]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <strong className="text-[15px] font-semibold">{r.design_name || "Untitled design"}</strong>
          <div className="mt-0.5 text-[13px] text-ink-soft">
            <UserLink id={r.user_id} /> · asked <span className="tabular-nums">{when(r.created_at)}</span>
            {r.place && <> · {r.place}</>}
          </div>
        </div>
        <Badge label={r.status} />
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <figure>
          <Picture src={`/api/ai-photos/${r.id}/image?which=input`} alt="The builder's picture of the design" />
          <figcaption className="mt-1 text-[12px] text-ink-soft">The design, as sent</figcaption>
        </figure>
        {r.result_path ? (
          <figure>
            <Picture src={resultImageUrl(r.id, r.result_path) ?? ""} alt="The photo sent to the user" />
            <figcaption className="mt-1 text-[12px] text-ink-soft">
              Sent <span className="tabular-nums">{when(r.completed_at)}</span>
              {r.completed_by && (
                <>
                  {" by "}
                  <UserLink id={r.completed_by} />
                </>
              )}
            </figcaption>
          </figure>
        ) : (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-soft">Prompt</p>
            {/* Rendered as text (React escapes it). */}
            <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-[5px] border border-line bg-paper p-3 text-[13px] leading-[1.6]">
              {r.prompt}
            </p>
          </div>
        )}
      </div>

      {r.status === "rejected" && r.admin_note && (
        <p className="mt-3 text-[13px] text-ink-soft">Reason given: {r.admin_note}</p>
      )}

      {/* a rejected request can still be finished: uploading undoes a mistaken reject */}
      {(
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <AiPhotoTools id={r.id} prompt={r.prompt} done={r.status === "done"} />
          {pending && (
            <AdminAction
              endpoint={`/api/admin/ai-photos/${r.id}`}
              actions={[
                ...(canGenerate
                  ? [{
                      action: "generate",
                      label: "Generate with Gemini",
                      tone: "neutral" as const,
                      confirm: "Make this photo with the API key? It is billed to the key's Google project and takes about half a minute.",
                    }]
                  : []),
                {
                  action: "reject",
                  label: "Reject",
                  tone: "danger" as const,
                  askNote: true,
                  notePrompt: "Why can this photo not be made? The user sees this.",
                },
              ]}
            />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * AI photo requests from the designer: the waiting queue (oldest first), then
 * what was recently sent or turned down.
 *
 * By hand: copy the prompt, download the picture, give both to an image tool
 * (Gemini, for one), and upload what it makes. With a billed API key set, the
 * "Generate with Gemini" button does the same in one step.
 */
export default async function AdminAiPhotos() {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();

  const [pending, recent] = await Promise.all([
    db
      .from("ai_photo_requests")
      .select(COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PENDING_LIMIT)
      .returns<Row[]>(),
    db
      .from("ai_photo_requests")
      .select(COLUMNS)
      .neq("status", "pending")
      .order("completed_at", { ascending: false })
      .limit(RECENT_LIMIT)
      .returns<Row[]>(),
  ]);
  const canGenerate = Boolean(process.env.GEMINI_API_KEY);
  const waiting = pending.data ?? [];
  const finished = recent.data ?? [];

  return (
    <>
      <PageHeader title="AI photos">
        <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-ink-soft">
          People ask for a photograph of their design. For each one: copy the prompt, download the
          picture, give both to an image tool, and upload the photo it makes. The person then finds
          it in the designer.
        </p>
      </PageHeader>
      <LoadError errors={[pending.error?.message, recent.error?.message]} />

      <Section title="Waiting" count={waiting.length}>
        {waiting.length ? (
          <ul className="flex flex-col gap-4">
            {waiting.map((r) => (
              <RequestCard key={r.id} r={r} canGenerate={canGenerate} />
            ))}
          </ul>
        ) : (
          <Empty>No one is waiting for a photo.</Empty>
        )}
      </Section>

      <Section title="Recently finished" count={finished.length}>
        {finished.length ? (
          <ul className="flex flex-col gap-4">
            {finished.map((r) => (
              <RequestCard key={r.id} r={r} canGenerate={canGenerate} />
            ))}
          </ul>
        ) : (
          <Empty>Nothing sent yet.</Empty>
        )}
      </Section>
    </>
  );
}
