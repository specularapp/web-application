import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumePublic } from "@/features/resume/components/resume-public";
import { loadPublicResume } from "@/features/resume/public";
import { createMetadata } from "@/lib/metadata";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const resume = await loadPublicResume(slug);
  if (!resume) return createMetadata({ title: "Currículo", description: "Este currículo não está disponível.", noIndex: true });

  return createMetadata({
    title: resume.name ?? "Currículo",
    description: resume.headline ?? `O currículo de ${resume.name ?? "um profissional"} publicado com Specular.`,
    path: `/cv/${slug}`,
    absoluteTitle: true,
  });
}

// O currículo público (2026-09-17): só existe com o endereço preenchido e a chave ligada.
export default async function PublicResumePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const resume = await loadPublicResume(slug);
  if (!resume) notFound();

  return <ResumePublic {...resume} />;
}
