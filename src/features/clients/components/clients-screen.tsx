import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { ClientsListPage, ClientsQuery } from "../list-options";
import { ClientsBoard } from "./clients-board";

export type ClientsScreenProps = { page: ClientsListPage; query: ClientsQuery };

// A tela de clientes inteira. O título fica só para o leitor de tela: quem diz onde a pessoa está é o
// menu, e a referência não abre espaço para um cabeçalho de página. A regra de um `h1` por página
// continua valendo, então ele existe, oculto. Server Component: quem tem estado é a prancha.
export function ClientsScreen({ page, query }: ClientsScreenProps) {
  return (
    <>
      <VisuallyHidden>
        <Text as="h1" variant="title2" weight="semibold">
          Clientes
        </Text>
      </VisuallyHidden>
      <ClientsBoard page={page} query={query} />
    </>
  );
}
