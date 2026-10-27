import { ClientsRoute } from "@/features/clients/components/clients-route";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Novo cliente",
  description: "Cadastre um cliente na base",
  path: "/clientes/novo",
  noIndex: true,
});

// A criação é a listagem com a janela aberta: endereço próprio para o formulário ser compartilhável e
// recarregável, e a lista atrás continua a mesma.
export default async function NewClientPage({ searchParams }: PageProps<"/clientes/novo">) {
  return <ClientsRoute group="clientes" search={await searchParams} editing="new" />;
}
