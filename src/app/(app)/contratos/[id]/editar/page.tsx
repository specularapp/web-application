import { notFound, redirect } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { ContractEditorScreen } from "@/features/contracts/components/contract-editor-screen";
import { findContract, readContractLookups } from "@/features/contracts/store";
import { hasAi } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/contratos/[id]/editar">) {
  const { id } = await params;
  const contract = await findContract(id);

  return createMetadata({
    title: contract ? `Editar ${contract.title}` : "Editar contrato",
    description: "Editor do contrato, com o documento, as partes e os campos de assinatura",
    path: `/contratos/${id}/editar`,
    noIndex: true,
  });
}

// O editor do contrato, uma tela inteira: só rascunho se edita, porque documento enviado não muda por baixo
// de quem vai assinar; o resto cai na ficha.
export default async function EditContractPage({ params }: PageProps<"/contratos/[id]/editar">) {
  const { id } = await params;
  const contract = await findContract(id);
  if (!contract) notFound();
  if (contract.status !== "draft") redirect(`/contratos/${id}`);

  return <ContractEditorScreen contract={contract} lookups={await readContractLookups()} ai={previewAiUsage} aiAvailable={hasAi()} />;
}
