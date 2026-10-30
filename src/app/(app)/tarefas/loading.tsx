import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="board" toolbar={{ filter: true, action: true }} label="Carregando o quadro de tarefas" />;
}
