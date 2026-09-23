import { getAiUsageData } from "@/features/ai/queries";
import { FormEditorScreen } from "@/features/forms/components/form-editor-screen";
import { getFormEditorData } from "@/features/forms/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({ title: "Novo formulário", description: "Crie perguntas e publique um formulário para o cliente", path: "/formularios/novo", noIndex: true });

export default async function NewFormPage() {
  const [data, ai] = await Promise.all([getFormEditorData(), getAiUsageData()]);
  return <FormEditorScreen {...data} ai={ai} />;
}
