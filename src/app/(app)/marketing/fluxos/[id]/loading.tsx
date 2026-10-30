import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="canvas" toolbar={false} label="Carregando o fluxo" />;
}
