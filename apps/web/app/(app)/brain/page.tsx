import { getBrain, prisma } from "@contextos/database";
import { BrainEditor } from "@/components/brain-editor";
import { PageHeader } from "@/components/page-header";
import { requirePageAuth } from "@/lib/server/auth";

export const metadata = { title: "Company Brain" };

export default async function BrainPage() {
  const { organization } = await requirePageAuth();
  const brain = await getBrain(prisma, organization!.id);
  return (
    <>
      <PageHeader
        title="Company Brain"
        description="Explain your company once. ContextOS picks only the relevant pieces for each request — it never sends everything."
      />
      <BrainEditor initial={brain} />
    </>
  );
}
