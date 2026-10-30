import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="cards" card="item" label="Carregando o catálogo" />;
}
