import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="cards" card="profile" label="Carregando os clientes" />;
}
