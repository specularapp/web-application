import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicApprovalView } from "@/features/approvals/components/public-approval";
import { loadPublicApproval } from "@/features/approvals/public";
import { createMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicApproval(token);
  return createMetadata({ title: data?.approval.title ?? "Aprovação", description: data?.approval.description || "Revise a entrega e registre sua decisão", path: `/aprovacao/${token}`, noIndex: true });
}

export default async function PublicApprovalPage({ params }: Props) {
  const { token } = await params;
  const data = await loadPublicApproval(token);
  if (!data) notFound();
  return <PublicApprovalView data={data} token={token} />;
}
