import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { AutomationEditorScreen } from "@/features/automations/components/automation-editor-screen";
import { getAutomationById } from "@/features/automations/queries";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/automacoes/[id]">) {
  const { id } = await params;
  const automation = await getAutomationById(id);

  return createMetadata({
    title: automation ? automation.name : "Automação",
    description: "Editor da automação, com o quadro do fluxo, os passos e o histórico de execuções",
    path: `/automacoes/${id}`,
    noIndex: true,
  });
}

// O editor da automação, uma tela inteira: abrir um cartão da lista chega aqui.
export default async function AutomationPage({ params }: PageProps<"/automacoes/[id]">) {
  const { id } = await params;
  const [automation, ai] = await Promise.all([getAutomationById(id), getAiUsageData()]);
  if (!automation) notFound();

  return <AutomationEditorScreen automation={automation} ai={ai} />;
}
