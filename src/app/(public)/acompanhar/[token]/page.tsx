import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectTrackingPublic } from "@/features/projects/components/project-tracking-public";
import { loadPublicProjectTracking, recordPublicProjectTrackingView } from "@/features/projects/public";
import { createMetadata } from "@/lib/metadata";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const found = await loadPublicProjectTracking(token);
  if (!found) return createMetadata({ title: "Acompanhamento do projeto", description: "Este acompanhamento não está mais disponível.", noIndex: true });
  return createMetadata({
    title: found.project.name,
    description: `Acompanhe o andamento de ${found.project.name}, projeto conduzido por ${found.organization.name}.`,
    path: `/acompanhar/${token}`,
    noIndex: true,
    absoluteTitle: true,
  });
}

export default async function ProjectTrackingPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const found = await loadPublicProjectTracking(token);
  if (!found) notFound();
  await recordPublicProjectTrackingView(token);
  return <ProjectTrackingPublic tracking={found} />;
}
