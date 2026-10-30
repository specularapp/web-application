import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[13, 8, 8, 9, 9, 7, 9]} toolbar={{ filter: true, view: true, action: true }} label="Carregando as movimentações" />;
}
