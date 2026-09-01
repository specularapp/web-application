import { requireOnboarding } from "@/features/onboarding/guard";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Painel",
  description: "Visão geral de oportunidades, cobranças, projetos e finanças",
  path: "/dashboard",
});

export default async function DashboardPage() {
  await requireOnboarding();
  return null;
}
