import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicForm } from "@/features/forms/components/public-form";
import { loadPublicIntakeForm } from "@/features/forms/public";
import { createMetadata } from "@/lib/metadata";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const found = await loadPublicIntakeForm(token);
  if (!found) return createMetadata({ title: "Formulário", description: "Este formulário não está mais disponível.", noIndex: true });
  return createMetadata({ title: found.form.title, description: `${found.project.name}, por ${found.organization.name}.`, path: `/formulario/${token}`, noIndex: true, absoluteTitle: true });
}

export default async function PublicFormPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const found = await loadPublicIntakeForm(token);
  if (!found) notFound();
  return <PublicForm token={token} data={found} />;
}
