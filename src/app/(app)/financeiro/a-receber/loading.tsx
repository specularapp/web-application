import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[13, 12, 8, 8, 9, 9, 9]} toolbar={{ filter: true, view: true }} label="Carregando as contas a receber" />;
}
