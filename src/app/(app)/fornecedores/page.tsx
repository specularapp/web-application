import { ClientsRoute } from "@/features/clients/components/clients-route";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Fornecedores",
  description: "Gestão de fornecedores, despesas e pagamentos ligados",
  path: "/fornecedores",
});

// Os fornecedores na tela própria (2026-10-26, a pedido: "separe de fornecedores"), a mesma base dos clientes
// recortada pelo outro lado da relação.
export default async function SuppliersPage({ searchParams }: PageProps<"/fornecedores">) {
  return <ClientsRoute group="fornecedores" search={await searchParams} />;
}
