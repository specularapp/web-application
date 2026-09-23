import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { FormEditorScreen } from "@/features/forms/components/form-editor-screen";
import { getFormEditorData } from "@/features/forms/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({ title: "Editar formulário", description: "Perguntas, publicação e consentimento do formulário", noIndex: true });

export default async function EditFormPage({ params }: PageProps<"/formularios/[id]">) {
  const { id } = await params;
  const [data, ai] = await Promise.all([getFormEditorData(id, `/formularios/${id}`), getAiUsageData()]);
  if (!data.form) notFound();
  return <FormEditorScreen {...data} ai={ai} />;
}
