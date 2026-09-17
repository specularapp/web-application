import { PageSkeleton } from "@/components/layout/page-skeleton";

/**
 * O esqueleto de qualquer tela da aplicação que não declara o próprio. Ele é o que faz a navegação parecer
 * instantânea: sem isto, o clique ficava na tela anterior até a consulta do servidor voltar.
 */
export default function AppLoading() {
  return <PageSkeleton shape="rows" />;
}
