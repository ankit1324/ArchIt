import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { auditHistory } from "@/lib/admin-audit";
import { AuditTable, LoadError, PageHeader, Section } from "../ui";

export const metadata = { title: "Audit log" };

/** Every admin action, newest first. */
export default async function AdminLog() {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  const { entries, error } = await auditHistory(undefined, 200);
  return (
    <>
      <LoadError errors={[error]} />
      <PageHeader title="Audit log">
        <p className="mt-3 max-w-2xl text-[14px] leading-[1.7] text-ink-soft">
          Every moderation decision on listings, reports, designs, users and orders.
        </p>
      </PageHeader>
      <Section title="Latest admin actions" count={entries.length}>
        <AuditTable rows={entries} />
      </Section>
    </>
  );
}
