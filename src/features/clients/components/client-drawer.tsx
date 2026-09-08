"use client";

import { PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
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

  return (
    <Dialog
      open={Boolean(client)}
      onClose={onClose}
      label={client ? `Ficha de ${client.name}` : "Ficha do cliente"}
      size="lg"
      placement="end"
      surface="glass"
      scrim={false}
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
              <Text variant="caption1" tone="secondary" className={styles.since}>
                Cliente desde {longDate(client.createdAt)}
              </Text>
            </div>
            <div className={styles.headActions}>
              <IconButton label="Editar cliente" variant="ghost" size="sm">
                <PencilSimpleIcon />
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
                {/* Só a empresa e o que ela faz: e-mail e telefone moram na seção de contato logo
                    abaixo, e repeti-los aqui era dizer a mesma coisa duas vezes (pedido de 2026-09-08). */}
                {(full?.company || full?.role) && (
                  <Text variant="footnote" tone="secondary" truncate>
                    {[full.company, full.role].filter(Boolean).join(", ")}
                  </Text>
                )}
              </div>
              {full && (
                <div className={styles.contact}>
                  {/* A ação principal, o WhatsApp, leva o nome escrito, como no cartão de perfil do painel;
                      e-mail e ligar ficam só no ícone. */}
                  {clientActions(full).map(({ label, icon: Glyph, href, primary, background, foreground, external: opensTab }) => {
                    const shared = {
                      href,
                      variant: primary ? ("primary" as const) : ("outline" as const),
                      background,
                      foreground,
                      size: "sm" as const,
                      radius: "md" as const,
                      ...(opensTab && external),
                    };
                    return primary ? (
                      <Button key={label} {...shared} iconStart={<Glyph weight="bold" />} className={styles.primaryAction}>
                        {label}
                      </Button>
                    ) : (
                      <IconButton key={label} {...shared} label={label}>
                        <Glyph weight="bold" />
                      </IconButton>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Os números da relação em azulejos com fio, cada um com o rótulo em cima e o valor
                embaixo: é a faixa de fatos da referência, na paleta da casa. */}
            {full && (
              <dl className={styles.tiles}>
                <Tile label="Orçamentos" value={String(full.stats.quotes)} />
                {/* Projetos sai no celular: três azulejos fecham a linha, e quatro deixavam um solto; a
                    contagem continua na seção de projetos logo abaixo. */}
                <Tile label="Projetos" value={String(full.stats.projects)} className={styles.tileWide} />
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

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cx(styles.tile, className)}>
      <Text as="dt" variant="caption1" tone="secondary" truncate>
        {label}
      </Text>
      <Text as="dd" variant="title3" weight="semibold" numeric className={styles.tileValue}>
        {value}
      </Text>
    </div>
  );
}
