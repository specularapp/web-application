"use client";

import styled from "@emotion/styled";
import { CalendarBlankIcon, EnvelopeSimpleIcon, IdentificationCardIcon, PhoneIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { ProfileFact, ProfileFacts, ProfileSection } from "@/components/ui/profile";
import { Text } from "@/components/ui/text";
import { applyPattern } from "@/lib/masks";
import type { ClientListItem } from "../list-options";

export type ClientDrawerProps = {
  /** O cliente aberto; nulo mantém a gaveta montada e fechada, para a saída animar. */
  client: ClientListItem | null;
  onClose: () => void;
};

const Header = styled.header`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-block-end: 0.0375rem solid var(--color-border);
`;

const Naming = styled.div`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

const Close = styled.span`
  flex-shrink: 0;
`;

const Body = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-5);
  flex: 1;
  min-height: 0;
  padding: var(--space-5);
  overflow-y: auto;
  overscroll-behavior: contain;
`;

const Marks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`;

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });

// A ficha do cliente na gaveta lateral, aberta ao clicar no cartão da listagem. Uma gaveta só para a
// tela inteira, e não uma por cartão: quem guarda quem está aberto é a prancha, então vinte e quatro
// cartões não montam vinte e quatro janelas. No celular a `Dialog` troca a lateral pela bandeja, como em
// toda camada da casa. O conteúdo hoje é o que a listagem carrega; o layout completo entra aqui quando
// estiver definido, e o resto da ficha vem junto do domínio no banco.
export function ClientDrawer({ client, onClose }: ClientDrawerProps) {
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
          <Header>
            <Avatar name={client.name} src={client.avatarUrl ?? undefined} seed={client.email ?? client.name} size="md" shape="squircle" />
            <Naming>
              <Text as="h2" variant="headline" weight="semibold" truncate>
                {client.name}
              </Text>
              {client.company && (
                <Text variant="footnote" tone="secondary" truncate>
                  {client.company}
                </Text>
              )}
            </Naming>
            <Close>
              <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
                <XIcon />
              </IconButton>
            </Close>
          </Header>

          <Body>
            <Marks>
              <Badge tone={client.active ? "success" : "neutral"} size="sm">
                {client.active ? "Ativo" : "Inativo"}
              </Badge>
              {client.favorite && (
                <Badge tone="yellow" size="sm">
                  Favorito
                </Badge>
              )}
            </Marks>

            <ProfileSection title="Contato">
              <ProfileFacts>
                <ProfileFact icon={EnvelopeSimpleIcon} label="E-mail">
                  <Text as="span" variant="subheadline" weight="medium" truncate>
                    {client.email ?? "Não informado"}
                  </Text>
                </ProfileFact>
                <ProfileFact icon={PhoneIcon} label="Telefone">
                  <Text as="span" variant="subheadline" weight="medium" numeric>
                    {phone ?? "Não informado"}
                  </Text>
                </ProfileFact>
                <ProfileFact icon={CalendarBlankIcon} label="Cliente desde">
                  <Text as="span" variant="subheadline" weight="medium">
                    {longDate(client.createdAt)}
                  </Text>
                </ProfileFact>
                <ProfileFact icon={IdentificationCardIcon} label="Identificador">
                  <Text as="span" variant="subheadline" weight="medium">
                    {client.reference}
                  </Text>
                </ProfileFact>
              </ProfileFacts>
            </ProfileSection>
          </Body>
        </>
      )}
    </Dialog>
  );
}
