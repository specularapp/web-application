import {
  CalendarBlankIcon,
  EnvelopeSimpleIcon,
  FolderOpenIcon,
  GlobeIcon,
  IdentificationCardIcon,
  MapPinIcon,
  PhoneIcon,
  ReceiptIcon,
  StarIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/ssr";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { avatarHue } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/link";
import { Profile, ProfileFact, ProfileFacts, ProfileList, ProfileProgress, ProfileRow, ProfileSection, ProfileTags, type ProfileAction } from "@/components/ui/profile";
import { Text } from "@/components/ui/text";
import { quoteStatuses } from "@/features/quotes/labels";
import { applyPattern } from "@/lib/masks";
import { compactMoney, formatMoney } from "@/lib/utils/format";
import type { Client, ClientProjectStatus } from "../summary";
import { ClientMenu } from "./client-menu";
import styles from "./client-profile.module.css";

export type ClientProfileProps = { client: Client };

/** Até quantos dias depois de entrar a pessoa ainda é "Novo cliente". */
const NEW_CLIENT_DAYS = 7;

const projectStatuses: Record<ClientProjectStatus, { label: string; tone: BadgeTone }> = {
  ongoing: { label: "Em andamento", tone: "accent" },
  done: { label: "Concluído", tone: "success" },
  paused: { label: "Pausado", tone: "warning" },
};

/* Links que saem da aplicação abrem em outra aba; o botão passa os atributos ao `a` quando tem `href`. */
const external = { target: "_blank", rel: "noreferrer" };

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });
const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });
const hostOf = (url: string) => new URL(url).host;

// O perfil do cliente sobre o cartão de perfil da casa: etiquetas de novo, ativo e favorito, o menu de
// opções, os números da relação, os botões de contato e as seções de anotações, contato, etiquetas,
// orçamentos vinculados e projetos. É Server Component: a linha do bloco é quem abre, e passa o perfil
// pronto à janela.
export function ClientProfile({ client }: ClientProfileProps) {
  const seed = client.email ?? client.name;
  const isNew = differenceInCalendarDays(new Date(), parseISO(client.createdAt)) <= NEW_CLIENT_DAYS;
  const phone = client.phone ? applyPattern("phone", client.phone) : null;
  const actions: ProfileAction[] = [
    ...(client.phone
      ? [{ label: "WhatsApp", icon: WhatsappLogoIcon, href: `https://wa.me/55${client.phone}`, primary: true, background: "var(--color-whatsapp)", foreground: "var(--color-on-whatsapp)", external: true }]
      : []),
    ...(client.email ? [{ label: "E-mail", icon: EnvelopeSimpleIcon, href: `mailto:${client.email}` }] : []),
    ...(client.phone ? [{ label: "Ligar", icon: PhoneIcon, href: `tel:+55${client.phone}` }] : []),
  ];

  return (
    <Profile
      hue={avatarHue(seed)}
      avatar={{ name: client.name, src: client.avatarUrl ?? undefined, seed }}
      title={client.name}
      badges={
        <>
          {isNew && (
            <Badge tone="accent" size="sm">
              Novo cliente
            </Badge>
          )}
          <Badge tone={client.active ? "success" : "neutral"} size="sm">
            {client.active ? "Ativo" : "Inativo"}
          </Badge>
          {client.favorite && <Badge tone="yellow" size="sm" icon={<StarIcon weight="fill" />} label="Favorito" />}
        </>
      }
      menu={<ClientMenu client={client} historyCount={12} />}
      handle={client.email ?? undefined}
      subtitle={[client.company, client.role].filter(Boolean).join(", ") || undefined}
      stats={[
        { label: "Orçamentos", value: String(client.stats.quotes) },
        { label: "Projetos", value: String(client.stats.projects) },
        { label: "Faturado", value: compactMoney(client.stats.billed) },
        { label: "Em aberto", value: compactMoney(client.stats.open) },
      ]}
      actions={actions}
    >
      {client.about && (
        <ProfileSection title="Sobre">
          <Text variant="callout" tone="secondary">
            {client.about}
          </Text>
        </ProfileSection>
      )}

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
          {client.city && (
            <ProfileFact icon={MapPinIcon} label="Cidade">
              <Text as="span" variant="subheadline" weight="medium">
                {client.city}
              </Text>
            </ProfileFact>
          )}
          {client.website && (
            <ProfileFact icon={GlobeIcon} label="Site">
              <TextLink href={client.website as Route} {...external}>
                {hostOf(client.website)}
              </TextLink>
            </ProfileFact>
          )}
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

      {client.tags.length > 0 && (
        <ProfileSection title="Etiquetas">
          <ProfileTags>
            {client.tags.map((tag) => (
              <Badge key={tag} size="md">
                {tag}
              </Badge>
            ))}
          </ProfileTags>
        </ProfileSection>
      )}

      <ProfileSection
        title="Orçamentos"
        aside={
          <TextLink href={"/orcamentos" as Route} className={styles.more}>
            Ver todos
          </TextLink>
        }
      >
        {client.quotes.length === 0 ? (
          <Text variant="footnote" tone="secondary">
            Nenhum orçamento vinculado ainda
          </Text>
        ) : (
          <ProfileList>
            {client.quotes.map((quote) => {
              const status = quoteStatuses[quote.status];
              return (
                <ProfileRow
                  key={quote.id}
                  href={`/orcamentos/${quote.id}` as Route}
                  icon={ReceiptIcon}
                  title={quote.title}
                  caption={`${quote.number}, ${shortDate(quote.date)}`}
                  end={
                    <>
                      <Text as="span" variant="subheadline" weight="semibold">
                        {formatMoney(quote.amount)}
                      </Text>
                      <Badge tone={status.tone} size="sm" icon={<status.icon />}>
                        {status.label}
                      </Badge>
                    </>
                  }
                />
              );
            })}
          </ProfileList>
        )}
      </ProfileSection>

      <ProfileSection title="Projetos">
        {client.projects.length === 0 ? (
          <Text variant="footnote" tone="secondary">
            Nenhum projeto por aqui
          </Text>
        ) : (
          <ProfileList>
            {client.projects.map((project) => {
              const status = projectStatuses[project.status];
              return (
                <ProfileRow
                  key={project.id}
                  href={`/projetos/${project.id}` as Route}
                  icon={FolderOpenIcon}
                  title={project.name}
                  caption={<ProfileProgress value={project.progress} done={project.status === "done"} />}
                  end={
                    <Badge tone={status.tone} size="sm">
                      {status.label}
                    </Badge>
                  }
                />
              );
            })}
          </ProfileList>
        )}
      </ProfileSection>
    </Profile>
  );
}
