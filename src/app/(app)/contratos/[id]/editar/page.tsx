import { notFound, redirect } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractEditorScreen } from "@/features/contracts/components/contract-editor-screen";
import { requireOrganization } from "@/features/organizations/context";
import { getContract, getContractLookups } from "@/features/contracts/service";
import { hasAi } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/contratos/[id]/editar">) {
  const { id } = await params;
  const { supabase, organizationId } = await requireOrganization(`/contratos/${id}/editar`);
  const contract = await getContract(supabase, organizationId, id);

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
  const { supabase, organizationId } = await requireOrganization(`/contratos/${id}/editar`);

  const [contract, lookups, ai] = await Promise.all([
    getContract(supabase, organizationId, id),
    getContractLookups(supabase, organizationId),
    getAiUsageData(),
  ]);

  if (!contract) notFound();
  if (contract.status !== "draft") redirect(`/contratos/${id}`);

  return <ContractEditorScreen contract={contract} lookups={lookups} ai={ai} aiAvailable={hasAi()} />;
}
