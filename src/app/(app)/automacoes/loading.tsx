import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="cards" card="item" toolbar={{ filter: true, action: true }} label="Carregando as automações" />;
}
