import {
  CalendarBlankIcon,
  EnvelopeSimpleIcon,
  FolderOpenIcon,
  GlobeIcon,
  IdentificationCardIcon,
  MapPinIcon,
  PhoneIcon,
  ReceiptIcon,
} from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/link";
import { ProfileFact, ProfileFacts, ProfileList, ProfileProgress, ProfileRow, ProfileSection, ProfileTags } from "@/components/ui/profile";
import { Text } from "@/components/ui/text";
import { quoteStatuses } from "@/features/quotes/labels";
import { applyPattern } from "@/lib/masks";
import { formatMoney } from "@/lib/utils/format";
import type { Client, ClientProjectStatus } from "../summary";
import styles from "./client-sections.module.css";

export type ClientSectionsProps = { client: Client };

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

// O miolo da ficha do cliente: sobre, contato, etiquetas, orçamentos vinculados e projetos. Vive num
// componente só porque duas telas mostram a mesma coisa com molduras diferentes: o cartão de perfil que
// o painel abre e a gaveta lateral da listagem. Server Component, sem estado: quem tem moldura é quem
// chama.
export function ClientSections({ client }: ClientSectionsProps) {
  const phone = client.phone ? applyPattern("phone", client.phone) : null;

  return (
    <>
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
    </>
  );
}
