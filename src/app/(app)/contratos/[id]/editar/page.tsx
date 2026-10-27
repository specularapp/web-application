import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_VIEW_COOKIE, contractsQueryFrom, parseContractsView } from "@/features/contracts/list";
import { getContractById, loadContractsScreenData } from "@/features/contracts/queries";
import { hasAi } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/contratos/[id]/editar">) {
  const { id } = await params;
  const contract = await getContractById(id, `/contratos/${id}/editar`);

  return createMetadata({
    title: contract ? `Editar ${contract.title}` : "Editar contrato",
    description: "Editor do contrato, com o documento, as partes e os campos de assinatura",
    path: `/contratos/${id}/editar`,
    noIndex: true,
  });
}

/**
 * O editor do contrato é a lista com a janela grande do editor aberta nele (2026-10-26, a pedido: "abrir em
 * modal grande também"), na receita de `/orcamentos/[id]`: o endereço segue próprio, e a lista atrás é a
 * mesma. Só rascunho se edita, porque documento enviado não muda por baixo de quem vai assinar; o resto cai
 * na ficha.
 */
export default async function EditContractPage({ params, searchParams }: PageProps<"/contratos/[id]/editar">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const view = parseContractsView(cookieStore.get(CONTRACTS_VIEW_COOKIE)?.value);
  const query = contractsQueryFrom(search, view);
  const next = `/contratos/${id}/editar`;

  const [contract, data, ai] = await Promise.all([getContractById(id, next), loadContractsScreenData(query, next), getAiUsageData()]);
  if (!contract) notFound();
  if (contract.status !== "draft") redirect(`/contratos/${id}`);

  return <ContractsScreen page={data.page} lookups={data.lookups} query={query} view={view} ai={ai} aiAvailable={hasAi()} editing={contract} />;
}
