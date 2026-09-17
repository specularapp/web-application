import { getAiUsageData } from "@/features/ai/queries";
import { AutomationsScreen } from "@/features/automations/components/automations-screen";
import { listAutomations, parseAutomationsQuery } from "@/features/automations/list";
import { getAutomations } from "@/features/automations/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Automações",
  description: "Lembretes, cobranças automáticas e fluxos que rodam sozinhos",
  path: "/automacoes",
});

export default async function AutomationsPage({ searchParams }: PageProps<"/automacoes">) {
  const params = await searchParams;
  const query = parseAutomationsQuery({ busca: first(params.busca), situacao: first(params.situacao) });

  const [automations, ai] = await Promise.all([getAutomations(), getAiUsageData()]);

  return <AutomationsScreen page={listAutomations(automations, query)} query={query} ai={ai} />;
}
