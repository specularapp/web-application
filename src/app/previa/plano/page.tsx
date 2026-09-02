import { notFound } from "next/navigation";
import { PlanSettings } from "@/features/billing/components/plan-settings";
import { previewInvoices, previewSubscribedState } from "@/features/billing/preview";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Prévia do plano e assinatura",
  description: "Prévia de front da tela de plano, pagamento e faturas",
  path: "/previa/plano",
  noIndex: true,
});

export default function PlanPreviewPage() {
  if (!isHomologation()) notFound();

  // Assinatura em teste gratuito, com cartão e faturas: é o estado com mais campos na tela de uma vez.
  // As ações são as de verdade e falham de propósito aqui, porque o time do exemplo não existe.
  return <PlanSettings state={previewSubscribedState} invoices={previewInvoices} />;
}
