import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { FormResponsesScreen } from "@/features/forms/components/form-responses-screen";
import { getFormResponsesData } from "@/features/forms/queries";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/formularios/[id]/respostas">): Promise<Metadata> {
  const { id } = await params;
  const { form } = await getFormResponsesData(id);
  return createMetadata({
    title: form ? `Respostas de ${form.title}` : "Respostas do formulário",
    description: "Respostas e consentimentos recebidos pelo formulário",
    path: `/formularios/${id}/respostas`,
    noIndex: true,
  });
}

export default async function FormResponsesPage({ params }: PageProps<"/formularios/[id]/respostas">) {
  const { id } = await params;
  const [{ form, submissions }, ai] = await Promise.all([getFormResponsesData(id), getAiUsageData()]);
  if (!form) notFound();
  return <FormResponsesScreen form={form} submissions={submissions} ai={ai} />;
}
