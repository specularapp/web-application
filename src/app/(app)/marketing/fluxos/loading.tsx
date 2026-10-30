import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[14, 8, 8, 7, 7, 8, 6, 9, 8, 6]} toolbar={{ filter: true, action: true }} label="Carregando os fluxos" />;
}
