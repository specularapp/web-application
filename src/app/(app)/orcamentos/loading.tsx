import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[13, 12, 8, 5, 8, 8, 8, 10]} label="Carregando os orçamentos" />;
}
