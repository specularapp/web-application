import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[13, 11, 8, 8, 9]} toolbar={{ filter: true, action: true }} label="Carregando os disparos" />;
}
