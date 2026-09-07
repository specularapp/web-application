import { CaretUpDownIcon } from "@phosphor-icons/react/ssr";
import { useId } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import type { Client, ClientsSummary } from "@/features/clients/summary";
import { applyPattern } from "@/lib/masks";
import list from "./block-list.module.css";
import styles from "./clients-block.module.css";

export type ClientsBlockProps = { summary: ClientsSummary };

const SHOWN_CLIENTS = 5;

const phoneOf = (client: Client) => (client.phone ? applyPattern("phone", client.phone) : null);

/* Os ícones vão com o peso da casa já escrito: quem os recebe é Client Component, e o que chega lá é o
   SVG pronto, que o `matchIconWeight` não consegue mais vestir. O menu de opções é o chevron duplo do
   menu, fantasma como os botões de ícone do cabeçalho. */
function MoreButton({ name }: { name: string }) {
  return (
    <IconButton label={`Mais opções de ${name}`} variant="ghost" size="sm">
      <CaretUpDownIcon weight="bold" />
    </IconButton>
  );
}

// O cliente mais novo em destaque: a foto grande à esquerda e, à direita, o nome com a etiqueta "Novo
// cliente" e o menu de mais opções na outra ponta da mesma linha, e a ficha em grade embaixo (e-mail e telefone, cada um com o
// próprio rótulo). O menu ainda não abre nada.
function Featured({ client }: { client: Client }) {
  const phone = phoneOf(client);

  return (
    <div className={styles.featured}>
      <Avatar
        name={client.name}
        src={client.avatarUrl ?? undefined}
        seed={client.email ?? client.name}
        size="lg"
        shape="squircle"
        className={styles.photo}
      />
      <div className={styles.sheet}>
        <div className={styles.identity}>
          <span className={styles.naming}>
            <Text as="p" variant="title3" weight="semibold" truncate>
              {client.name}
            </Text>
            <Badge tone="accent" size="sm">
              Novo cliente
            </Badge>
          </span>
          <MoreButton name={client.name} />
        </div>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <Text as="dt" variant="caption1" tone="secondary">
              E-mail
            </Text>
            <Text as="dd" variant="footnote" weight="medium" truncate>
              {client.email ?? "Não informado"}
            </Text>
          </div>
          <div className={styles.fact}>
            <Text as="dt" variant="caption1" tone="secondary">
              Telefone
            </Text>
            <Text as="dd" variant="footnote" weight="medium" numeric truncate>
              {phone ?? "Não informado"}
            </Text>
          </div>
        </dl>
      </div>
    </div>
  );
}

function Row({ client }: { client: Client }) {
  const phone = phoneOf(client);

  return (
    <li className={list.row}>
      <Avatar name={client.name} src={client.avatarUrl ?? undefined} seed={client.email ?? client.name} size="sm" shape="squircle" />
      <span className={list.copy}>
        <Text as="span" variant="subheadline" weight="medium" truncate>
          {client.name}
        </Text>
        {phone && (
          <Text as="span" variant="footnote" tone="secondary" numeric truncate>
            {phone}
          </Text>
        )}
      </span>
      <MoreButton name={client.name} />
    </li>
  );
}

// Quem chegou por último em destaque, e embaixo os outros mais novos, na mesma lista curta do bloco
// de financeiro: foto, nome e telefone, e o menu de mais opções na ponta.
export function ClientsBlock({ summary }: ClientsBlockProps) {
  const recentId = useId();
  const [latest, ...rest] = summary.clients;

  if (!latest) {
    return (
      <Text variant="footnote" tone="secondary">
        Nenhum cliente cadastrado ainda
      </Text>
    );
  }

  return (
    <div className={styles.block}>
      <Featured client={latest} />

      <section className={list.recent} aria-labelledby={recentId}>
        <Text as="h3" id={recentId} variant="caption1" weight="medium" tone="secondary">
          Outros clientes
        </Text>
        <ul className={list.list}>
          {rest.slice(0, SHOWN_CLIENTS).map((client) => (
            <Row key={client.id} client={client} />
          ))}
        </ul>
      </section>
    </div>
  );
}
