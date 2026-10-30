import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="table" label="Carregando a API" />;
}
