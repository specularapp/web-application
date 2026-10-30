import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="cards" toolbar={{ filter: true, action: true }} label="Carregando os projetos" />;
}
