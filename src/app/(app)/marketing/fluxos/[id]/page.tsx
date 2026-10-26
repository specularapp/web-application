import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { FlowEditorScreen } from "@/features/marketing/components/flow-editor-screen";
import { findSampleFlow, sampleFlowOptions } from "@/features/marketing/sample";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export async function generateMetadata({ params, searchParams }: PageProps<"/marketing/fluxos/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const flow = findSampleFlow(id, first(query.modelo));

  return createMetadata({
    title: flow ? flow.name : "Fluxo",
    description: "Construtor do fluxo de conversa, com os passos, as ligações, a prévia no celular e a publicação",
    path: `/marketing/fluxos/${id}`,
    noIndex: true,
  });
}

// O construtor do fluxo, uma tela inteira: abrir uma linha da lista ou escolher um modelo chega aqui.
export default async function FlowPage({ params, searchParams }: PageProps<"/marketing/fluxos/[id]">) {
  const [{ id }, query, ai] = await Promise.all([params, searchParams, getAiUsageData()]);
  const flow = findSampleFlow(id, first(query.modelo));
  if (!flow) notFound();

  return <FlowEditorScreen flow={flow} flows={sampleFlowOptions} ai={ai} />;
}
