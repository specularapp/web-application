import { notFound } from "next/navigation";
import { previewBillingState } from "@/features/billing/preview";
import { OnboardingPreview } from "@/features/onboarding/components/onboarding-preview";
import type { StepName } from "@/features/onboarding/components/onboarding-flow";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Prévia dos primeiros passos",
  description: "Prévia de front das etapas de configuração inicial",
  path: "/previa/primeiros-passos",
  noIndex: true,
});

const steps: StepName[] = ["time", "membros", "plano"];

function stepFrom(value: string | string[] | undefined): StepName {
  const first = Array.isArray(value) ? value[0] : value;
  return steps.find((step) => step === first) ?? "time";
}

export default async function OnboardingPreviewPage(props: PageProps<"/previa/primeiros-passos">) {
  // Fora de homologação a rota não existe: é ferramenta de ajuste visual, não tela de produto. O proxy
  // já a fecha, e o 404 aqui fecha também a chamada direta ao Server Component.
  if (!isHomologation()) notFound();

  const { etapa } = await props.searchParams;

  return <OnboardingPreview billing={previewBillingState} step={stepFrom(etapa)} />;
}
