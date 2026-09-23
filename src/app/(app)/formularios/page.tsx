import { getAiUsageData } from "@/features/ai/queries";
import { FormsScreen } from "@/features/forms/components/forms-screen";
import { getFormsScreenData } from "@/features/forms/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({ title: "Formulários", description: "Formulários personalizados para coletar informações dos clientes", path: "/formularios" });

export default async function FormsPage() {
  const [data, ai] = await Promise.all([getFormsScreenData(), getAiUsageData()]);
  return <FormsScreen {...data} ai={ai} />;
}
