import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractPublicView } from "@/features/contracts/components/contract-public-view";
import { loadPublicContract, markPublicContractViewed } from "@/features/contracts/public";
import { createMetadata } from "@/lib/metadata";

type Params = { token: string };

/** O título é o número e o nome do contrato; a descrição diz para quem. `noIndex`, porque a página é da parte. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const found = await loadPublicContract(token);
  if (!found) return createMetadata({ title: "Contrato", description: "Este contrato não está mais disponível.", noIndex: true });

  return createMetadata({
    title: `${found.contract.reference}: ${found.contract.title}`,
    description: `Contrato enviado para ${found.party.name} revisar e assinar.`,
    path: `/contrato/${token}`,
    noIndex: true,
    absoluteTitle: true,
  });
}

// A página pública do contrato, a que cada parte abre pelo link do e-mail: só por token, que é a credencial
// **da parte**, e não do contrato, então um convite não assina pelo outro. Abrir marca a visualização na
// linha do tempo.
export default async function PublicContractPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const found = await loadPublicContract(token);
  if (!found) notFound();

  await markPublicContractViewed(token);

  return <ContractPublicView contract={found.contract} party={found.party} />;
}
