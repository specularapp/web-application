import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[13, 11, 11, 8, 8, 7]} toolbar={{ filter: true, view: true, action: true }} label="Carregando as transferências" />;
}
