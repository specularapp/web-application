import { notFound } from "next/navigation";
import { ClientsRoute } from "@/features/clients/components/clients-route";
import { getClientById } from "@/features/clients/queries";
import { createMetadata } from "@/lib/metadata";

/** O nome do cliente no título da aba: é a ficha dele que a página abre. */
export async function generateMetadata({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const client = await getClientById(id);

  return createMetadata({
    title: client ? client.name : "Cliente",
    description: "Ficha do cliente, com histórico de orçamentos e projetos",
    path: `/clientes/${id}`,
    noIndex: true,
  });
}

// A mesma tela da base, com a janela da ficha já aberta no cliente do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function ClientPage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const client = await getClientById(id);
  if (!client) notFound();

  return <ClientsRoute group="clientes" search={search} editing={client} />;
}
