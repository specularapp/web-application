import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { previewSidebar } from "@/components/layout/sidebar/preview";
import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { previewProjectsSummary } from "@/features/projects/preview";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Prévia do painel",
  description: "Prévia de front do painel, com o menu e os blocos de exemplo",
  path: "/previa/painel",
  noIndex: true,
});

export default function DashboardPreviewPage() {
  if (!isHomologation()) notFound();

  const { user } = previewSidebar;

  return (
    <AppFrame sidebar={<Sidebar {...previewSidebar} />}>
      <DashboardScreen
        demo
        user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
        greeting="Vamos com tudo hoje!"
        period="mes"
        projects={previewProjectsSummary}
      />
    </AppFrame>
  );
}
