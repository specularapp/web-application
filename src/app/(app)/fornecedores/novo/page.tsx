import { ClientsRoute } from "@/features/clients/components/clients-route";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Novo fornecedor",
  description: "Cadastre um fornecedor na base",
  path: "/fornecedores/novo",
  noIndex: true,
});

export default async function NewSupplierPage({ searchParams }: PageProps<"/fornecedores/novo">) {
  return <ClientsRoute group="fornecedores" search={await searchParams} editing="new" />;
}
