import { notFound } from "next/navigation";
import { ChargePublicView } from "@/features/finance/components/charge-public-view";
import { loadPublicCharge, markPublicChargeViewed } from "@/features/finance/public";
import { createMetadata } from "@/lib/metadata";
import { formatMoney } from "@/lib/utils/format";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const found = await loadPublicCharge(token);
  if (!found) return createMetadata({ title: "Cobrança", description: "Esta cobrança não está mais disponível.", noIndex: true });

  const { charge, issuer } = found;

  return createMetadata({
    title: `${charge.reference}: ${charge.title}`,
    description: `${issuer.name} emitiu esta cobrança de ${formatMoney(charge.amount)} para ${charge.client.company ?? charge.client.name}.`,
    path: `/cobranca/${token}`,
    noIndex: true,
    absoluteTitle: true,
  });
}

// A página pública da cobrança, a que o cliente abre pelo link do e-mail: só por token, que é a credencial.
// Abrir registra a visualização na linha do tempo da cobrança.
export default async function PublicChargePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const found = await loadPublicCharge(token);
  if (!found) notFound();

  await markPublicChargeViewed(token);

  return <ChargePublicView charge={found.charge} issuerName={found.issuer.name} />;
}
