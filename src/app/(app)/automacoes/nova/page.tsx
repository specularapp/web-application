import { getAiUsageData } from "@/features/ai/queries";
import { AutomationsScreen } from "@/features/automations/components/automations-screen";
import { listAutomations, parseAutomationsQuery } from "@/features/automations/list";
import { getAutomations } from "@/features/automations/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Nova automação",
  description: "Crie uma automação a partir de um modelo da casa ou do zero",
  path: "/automacoes/nova",
  noIndex: true,
});

// A mesma tela da lista, com a janela de criar já aberta: a criação tem endereço próprio, e abrir pela lista
// só troca a URL, sem sair da tela. Mesmo contrato das outras telas de criação.
export default async function NewAutomationPage({ searchParams }: PageProps<"/automacoes/nova">) {
  const params = await searchParams;
  const query = parseAutomationsQuery({ busca: first(params.busca), situacao: first(params.situacao) });

  const [automations, ai] = await Promise.all([getAutomations(), getAiUsageData()]);

  return <AutomationsScreen page={listAutomations(automations, query)} query={query} ai={ai} creating />;
}
