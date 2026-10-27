import { ClientsRoute } from "@/features/clients/components/clients-route";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Clientes",
  description: "Gestão de clientes e histórico de relacionamento",
  path: "/clientes",
});

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  return <ClientsRoute group="clientes" search={await searchParams} />;
}
