"use client";

import { ArrowSquareOutIcon, PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { applyPattern } from "@/lib/masks";
import { compactMoney } from "@/lib/utils/format";
import { loadClientAction } from "../actions";
import type { ClientListItem } from "../list-options";
import type { Client } from "../summary";
import { ClientBadges, clientActions } from "./client-profile";
import { ClientMenu } from "./client-menu";
import { ClientSections } from "./client-sections";
import styles from "./client-drawer.module.css";

export type ClientDrawerProps = {
  /** O cliente aberto; nulo mantém a gaveta montada e fechada, para a saída animar. */
  client: ClientListItem | null;
  onClose: () => void;
};

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });

/* Links que saem da aplicação abrem em outra aba. */
const external = { target: "_blank", rel: "noreferrer" };

// A ficha do cliente na gaveta lateral, aberta ao clicar no cartão da listagem. A moldura segue a
// referência: o nome como título com as ações na outra ponta, a linha de identidade com os botões de
// contato, os números da relação em azulejos com fio, e abaixo o miolo, que é o mesmo `ClientSections`
// que o cartão de perfil do painel mostra. Uma gaveta só para a tela inteira, e não uma por cartão.
//
// A ficha completa é buscada ao abrir, e não mandada junto da listagem: ela tem anotações, orçamentos e
// projetos, e vinte e quatro delas por página encheriam a carga com o que a grade nem desenha. Enquanto
// vem, o cabeçalho já mostra o que o cartão sabia, então a gaveta nunca abre vazia.
export function ClientDrawer({ client, onClose }: ClientDrawerProps) {
  const [full, setFull] = useState<Client | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const id = client?.id;

  // Ajuste de estado durante o render, e não em efeito: é o que o React recomenda para reagir a prop
  // nova, e o lint barra `setState` síncrono dentro de efeito. Trocar de cliente limpa a ficha antiga no
  // mesmo render, senão a gaveta mostraria a de quem estava aberto antes enquanto a nova vem.
  if (id && asked !== id) {
    setAsked(id);
    setFull(null);
  }

  useEffect(() => {
    if (!id) return;

    let current = true;
    void loadClientAction(id).then((data) => {
      if (current) setFull(data);
    });

    return () => {
      current = false;
    };
  }, [id]);

  const phone = client?.phone ? applyPattern("phone", client.phone) : null;

  return (
    <Dialog
      open={Boolean(client)}
      onClose={onClose}
      label={client ? `Ficha de ${client.name}` : "Ficha do cliente"}
      size="lg"
      placement="end"
      surface="glass"
      focusOnOpen={false}
    >
      {client && (
        <>
          {/* O título e as ações ficam grudados no topo: a gaveta rola por dentro e o nome do cliente é
              a referência de onde a pessoa está. */}
          <header className={styles.head}>
            <div className={styles.heading}>
              <Text as="h2" variant="title3" weight="semibold" truncate>
                {client.name}
              </Text>
              <Text variant="caption1" tone="secondary">
                Cliente desde {longDate(client.createdAt)}
              </Text>
            </div>
            <div className={styles.headActions}>
              <Button variant="outline" size="sm" radius="md" iconStart={<PencilSimpleIcon />} className={styles.edit}>
                Editar
              </Button>
              <IconButton label="Abrir a ficha em tela cheia" variant="ghost" size="sm" href={`/clientes/${client.id}`}>
                <ArrowSquareOutIcon />
              </IconButton>
              {full && <ClientMenu client={full} historyCount={12} />}
              <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
                <XIcon />
              </IconButton>
            </div>
          </header>

          <div className={styles.body}>
            {/* A identidade com os botões de contato na outra ponta, como na referência. */}
            <section className={styles.identity}>
              <Avatar
                name={client.name}
                src={client.avatarUrl ?? undefined}
                seed={client.email ?? client.name}
                size="lg"
                shape="squircle"
              />
              <div className={styles.who}>
                <div className={styles.naming}>
                  <Text as="p" variant="headline" weight="semibold" truncate>
                    {client.name}
                  </Text>
                  {full && <ClientBadges client={full} />}
                </div>
                <Text variant="footnote" tone="secondary" truncate>
                  {[client.email, phone, client.company].filter(Boolean).join("  ·  ")}
                </Text>
              </div>
              {full && (
                <div className={styles.contact}>
                  {clientActions(full).map(({ label, icon: Glyph, href, primary, background, foreground, external: opensTab }) => (
                    <IconButton
                      key={label}
                      label={label}
                      href={href}
                      variant={primary ? "primary" : "outline"}
                      background={background}
                      foreground={foreground}
                      size="sm"
                      radius="md"
                      {...(opensTab && external)}
                    >
                      <Glyph weight="bold" />
                    </IconButton>
                  ))}
                </div>
              )}
            </section>

            {/* Os números da relação em azulejos com fio, cada um com o rótulo em cima e o valor
                embaixo: é a faixa de fatos da referência, na paleta da casa. */}
            {full && (
              <dl className={styles.tiles}>
                <Tile label="Orçamentos" value={String(full.stats.quotes)} />
                <Tile label="Projetos" value={String(full.stats.projects)} />
                <Tile label="Faturado" value={compactMoney(full.stats.billed)} />
                <Tile label="Em aberto" value={compactMoney(full.stats.open)} />
              </dl>
            )}

            {full ? (
              <div className={styles.sections}>
                <ClientSections client={full} />
              </div>
            ) : (
              <div className={styles.loading}>
                <Spinner size="md" label="Carregando a ficha do cliente" />
              </div>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tile}>
      <Text as="dt" variant="caption1" tone="secondary" truncate>
        {label}
      </Text>
      <Text as="dd" variant="title3" weight="semibold" numeric className={styles.tileValue}>
        {value}
      </Text>
    </div>
  );
}
