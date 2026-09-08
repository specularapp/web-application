import { notFound } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { ClientFormScreen } from "@/features/clients/components/client-form-screen";
import { previewClients } from "@/features/clients/list-preview";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Editar cliente",
  description: "Edição da ficha de um cliente da base",
  noIndex: true,
});

export default async function EditClientPage({ params }: PageProps<"/clientes/[id]/editar">) {
  const { id } = await params;
  // A ficha vem da prévia enquanto o domínio não existe no banco: quando a tabela nascer, muda só esta
  // linha, no mesmo contrato da listagem.
  const client = previewClients.find((entry) => entry.id === id);
  if (!client) notFound();

  return <ClientFormScreen client={client} ai={previewAiUsage} />;
}
