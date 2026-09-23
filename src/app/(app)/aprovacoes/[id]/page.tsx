import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ApprovalDetailScreen } from "@/features/approvals/components/approval-detail-screen";
import { getApprovalScreenData } from "@/features/approvals/queries";
import { createMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const approval = await getApprovalScreenData(id);
  return createMetadata({ title: approval?.title ?? "Aprovação", description: approval?.description || "Controle de versões e aprovação do cliente", path: `/aprovacoes/${id}`, noIndex: true });
}

export default async function ApprovalPage({ params }: Props) {
  const { id } = await params;
  const [approval, ai] = await Promise.all([getApprovalScreenData(id), getAiUsageData()]);
  if (!approval) notFound();
  return <ApprovalDetailScreen approval={approval} ai={ai} />;
}
