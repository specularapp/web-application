import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="inbox" toolbar={{ filter: true }} label="Carregando as respostas" />;
}
