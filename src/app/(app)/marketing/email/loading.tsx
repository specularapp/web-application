import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[14, 9, 10, 8, 7, 7, 7, 8, 8]} toolbar={{ filter: true, action: true }} label="Carregando os e-mails" />;
}
