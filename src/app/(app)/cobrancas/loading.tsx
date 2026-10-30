import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[13, 13, 8, 8, 9, 8, 7]} label="Carregando as cobranças" />;
}
