import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="sections" toolbar={false} label="Carregando as conquistas" />;
}
