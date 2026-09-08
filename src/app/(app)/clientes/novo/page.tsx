import { previewAiUsage } from "@/features/ai/preview";
import { ClientFormScreen } from "@/features/clients/components/client-form-screen";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Novo cliente",
  description: "Cadastro de um novo cliente na base",
  path: "/clientes/novo",
  noIndex: true,
});

export default function NewClientPage() {
  return <ClientFormScreen ai={previewAiUsage} />;
}
