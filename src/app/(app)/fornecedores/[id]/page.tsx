import { notFound } from "next/navigation";
import { ClientsRoute } from "@/features/clients/components/clients-route";
import { getClientById } from "@/features/clients/queries";
import { createMetadata } from "@/lib/metadata";

/** O nome do fornecedor no título da aba: é a ficha dele que a página abre. */
export async function generateMetadata({ params }: PageProps<"/fornecedores/[id]">) {
  const { id } = await params;
  const supplier = await getClientById(id, `/fornecedores/${id}`);

  return createMetadata({
    title: supplier ? supplier.name : "Fornecedor",
    description: "Ficha do fornecedor, com despesas e pagamentos ligados",
    path: `/fornecedores/${id}`,
    noIndex: true,
  });
}

export default async function SupplierPage({ params, searchParams }: PageProps<"/fornecedores/[id]">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const supplier = await getClientById(id, `/fornecedores/${id}`);
  if (!supplier) notFound();

  return <ClientsRoute group="fornecedores" search={search} editing={supplier} />;
}
