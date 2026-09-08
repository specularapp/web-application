import { EnvelopeSimpleIcon, PhoneIcon, StarIcon, WhatsappLogoIcon } from "@phosphor-icons/react/ssr";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { avatarHue } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Profile, type ProfileAction } from "@/components/ui/profile";
import { compactMoney } from "@/lib/utils/format";
import type { Client } from "../summary";
import { ClientMenu } from "./client-menu";
import { ClientSections } from "./client-sections";

export type ClientProfileProps = { client: Client };

/** Até quantos dias depois de entrar a pessoa ainda é "Novo". */
export const NEW_CLIENT_DAYS = 7;

/** Os botões de contato do cliente, os mesmos no cartão de perfil e na gaveta da listagem. */
export function clientActions(client: Client): ProfileAction[] {
  return [
    ...(client.phone
      ? [
          {
            label: "WhatsApp",
            icon: WhatsappLogoIcon,
            href: `https://wa.me/55${client.phone}`,
            primary: true,
            background: "var(--color-whatsapp)",
            foreground: "var(--color-on-whatsapp)",
            external: true,
          },
        ]
      : []),
    ...(client.email ? [{ label: "E-mail", icon: EnvelopeSimpleIcon, href: `mailto:${client.email}` }] : []),
    ...(client.phone ? [{ label: "Ligar", icon: PhoneIcon, href: `tel:+55${client.phone}` }] : []),
  ];
}

/** As etiquetas de situação do cliente, as mesmas nas duas molduras. */
export function ClientBadges({ client }: { client: Client }) {
  const isNew = differenceInCalendarDays(new Date(), parseISO(client.createdAt)) <= NEW_CLIENT_DAYS;

  return (
    <>
      {isNew && (
        <Badge tone="accent" size="sm">
          Novo
        </Badge>
      )}
      <Badge tone={client.active ? "success" : "neutral"} size="sm">
        {client.active ? "Ativo" : "Inativo"}
      </Badge>
      {client.favorite && <Badge tone="yellow" size="sm" icon={<StarIcon weight="fill" />} label="Favorito" />}
    </>
  );
}

// O perfil do cliente sobre o cartão de perfil da casa: a capa no matiz da pessoa, a foto grande, as
// etiquetas, o menu de opções, os números da relação e os botões de contato, e o miolo em
// `ClientSections`, o mesmo que a gaveta da listagem mostra. É Server Component: a linha do bloco é quem
// abre, e passa o perfil pronto à janela.
export function ClientProfile({ client }: ClientProfileProps) {
  const seed = client.email ?? client.name;

  return (
    <Profile
      hue={avatarHue(seed)}
      avatar={{ name: client.name, src: client.avatarUrl ?? undefined, seed }}
      title={client.name}
      badges={<ClientBadges client={client} />}
      menu={<ClientMenu client={client} historyCount={12} />}
      handle={client.email ?? undefined}
      subtitle={[client.company, client.role].filter(Boolean).join(", ") || undefined}
      stats={[
        { label: "Orçamentos", value: String(client.stats.quotes) },
        { label: "Projetos", value: String(client.stats.projects) },
        { label: "Faturado", value: compactMoney(client.stats.billed) },
        { label: "Em aberto", value: compactMoney(client.stats.open) },
      ]}
      actions={clientActions(client)}
    >
      <ClientSections client={client} />
    </Profile>
  );
}
