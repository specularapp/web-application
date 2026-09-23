import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFeedback } from "@/features/feedbacks/components/public-feedback";
import { loadPublicClientFeedback } from "@/features/feedbacks/public";
import { createMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicClientFeedback(token);
  return createMetadata({ title: data?.feedback.title ?? "Avaliação", description: data?.feedback.prompt ?? "Avaliação do projeto", path: `/avaliacao/${token}`, noIndex: true });
}

export default async function FeedbackPage({ params }: Props) {
  const { token } = await params;
  const data = await loadPublicClientFeedback(token);
  if (!data) notFound();
  return <PublicFeedback data={data} token={token} />;
}
