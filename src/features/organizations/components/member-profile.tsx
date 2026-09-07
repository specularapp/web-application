import type { Icon } from "@phosphor-icons/react";
import {
  CalendarBlankIcon,
  CrownIcon,
  EnvelopeSimpleIcon,
  FolderOpenIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StarIcon,
  UserIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { Avatar, avatarHue } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Profile, ProfileFact, ProfileFacts, ProfileList, ProfileProgress, ProfileRow, ProfileRule, ProfileSection, ProfileTags } from "@/components/ui/profile";
import { Text } from "@/components/ui/text";
import { applyPattern } from "@/lib/masks";
import { compactMoney } from "@/lib/utils/format";
import type { TeamMember, TeamMemberAccess, TeamMemberProjectStatus } from "../summary";
import styles from "./member-profile.module.css";

export type MemberProfileProps = { member: TeamMember };

const accessMeta: Record<TeamMemberAccess, { label: string; tone: BadgeTone; icon: Icon }> = {
  owner: { label: "Proprietário", tone: "yellow", icon: CrownIcon },
  admin: { label: "Administrador", tone: "info", icon: ShieldCheckIcon },
  member: { label: "Membro", tone: "neutral", icon: UserIcon },
};

const projectStatuses: Record<TeamMemberProjectStatus, { label: string; tone: BadgeTone }> = {
  ongoing: { label: "Em andamento", tone: "accent" },
  done: { label: "Concluído", tone: "success" },
  paused: { label: "Pausado", tone: "warning" },
};

/* Links que saem da aplicação abrem em outra aba; o botão passa os atributos ao `a` quando tem `href`. */
const external = { target: "_blank", rel: "noreferrer" };

const points = new Intl.NumberFormat("pt-BR");
const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });
const shortStamp = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });

// O perfil de quem é da equipe, sobre o mesmo cartão de perfil do cliente: o papel de acesso e a
// situação em etiquetas, os pontos de gamificação, o que a pessoa produziu em números, os botões de
// contato e as seções de apresentação, contato, habilidades, projetos em que está e, depois de um fio,
// a atividade recente. Sem diretiva de cliente: é estático, e o bloco da equipe, que é cliente, o
// renderiza dentro da janela.
export function MemberProfile({ member }: MemberProfileProps) {
  const access = accessMeta[member.access];
  const pending = member.status === "pending";
  const phone = member.phone ? applyPattern("phone", member.phone) : null;
  const whatsapp = member.phone ? `https://wa.me/55${member.phone}` : null;

  return (
    <Profile
      hue={avatarHue(member.name)}
      avatar={{ name: member.name, src: member.avatarUrl ?? undefined }}
      title={member.name}
      badges={
        <>
          <Badge tone={access.tone} size="sm" icon={<access.icon />}>
            {access.label}
          </Badge>
          {pending ? (
            <Badge tone="warning" size="sm">
              Convite pendente
            </Badge>
          ) : (
            <Badge tone="success" size="sm">
              Ativo
            </Badge>
          )}
        </>
      }
      menu={
        member.points > 0 && (
          <Badge tone="neutral" size="md" icon={<StarIcon weight="fill" />}>
            {points.format(member.points)} pontos
          </Badge>
        )
      }
      handle={member.email}
      subtitle={member.role}
      stats={[
        { label: "Entregues", value: String(member.metrics.deliveredProjects) },
        { label: "Faturamento", value: compactMoney(member.metrics.revenue) },
        { label: "Em andamento", value: String(member.metrics.activeProjects) },
        { label: "Tarefas abertas", value: String(member.metrics.openTasks) },
      ]}
      actions={
        <>
          {whatsapp && (
            <Button
              href={whatsapp}
              variant="primary"
              size="md"
              background="var(--color-whatsapp)"
              foreground="var(--color-on-whatsapp)"
              iconStart={<WhatsappLogoIcon weight="bold" />}
              fullWidth
              {...external}
            >
              WhatsApp
            </Button>
          )}
          <Button href={`mailto:${member.email}`} variant="outline" size="md" iconStart={<EnvelopeSimpleIcon weight="bold" />} fullWidth>
            E-mail
          </Button>
          {member.phone && (
            <Button href={`tel:+55${member.phone}`} variant="outline" size="md" iconStart={<PhoneIcon weight="bold" />} fullWidth>
              Ligar
            </Button>
          )}
        </>
      }
    >
      {pending && (
        <Text variant="callout" tone="secondary">
          O convite foi enviado e ainda não foi aceito. Quando a pessoa entrar, o perfil ganha os números e a atividade.
        </Text>
      )}

      {member.bio && (
        <ProfileSection title="Sobre">
          <Text variant="callout" tone="secondary">
            {member.bio}
          </Text>
        </ProfileSection>
      )}

      <ProfileSection title="Contato">
        <ProfileFacts>
          <ProfileFact icon={EnvelopeSimpleIcon} label="E-mail">
            <Text as="span" variant="subheadline" weight="medium" truncate>
              {member.email}
            </Text>
          </ProfileFact>
          <ProfileFact icon={PhoneIcon} label="Telefone">
            <Text as="span" variant="subheadline" weight="medium" numeric>
              {phone ?? "Não informado"}
            </Text>
          </ProfileFact>
          {member.city && (
            <ProfileFact icon={MapPinIcon} label="Cidade">
              <Text as="span" variant="subheadline" weight="medium">
                {member.city}
              </Text>
            </ProfileFact>
          )}
          <ProfileFact icon={CalendarBlankIcon} label={pending ? "Convidado em" : "Na equipe desde"}>
            <Text as="span" variant="subheadline" weight="medium">
              {longDate(member.joinedAt)}
            </Text>
          </ProfileFact>
          <ProfileFact icon={access.icon} label="Acesso">
            <Text as="span" variant="subheadline" weight="medium">
              {access.label}
            </Text>
          </ProfileFact>
        </ProfileFacts>
      </ProfileSection>

      {member.skills.length > 0 && (
        <ProfileSection title="Habilidades">
          <ProfileTags>
            {member.skills.map((skill) => (
              <Badge key={skill} size="md">
                {skill}
              </Badge>
            ))}
          </ProfileTags>
        </ProfileSection>
      )}

      {!pending && (
        <ProfileSection title="Projetos">
          {member.projects.length === 0 ? (
            <Text variant="footnote" tone="secondary">
              Nenhum projeto no momento
            </Text>
          ) : (
            <ProfileList>
              {member.projects.map((project) => {
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
      )}

      {member.activity.length > 0 && (
        <>
          <ProfileRule />
          <ProfileSection title="Atividade recente">
            <ol className={styles.events}>
              {member.activity.map((event) => (
                <li key={event.id} className={styles.event}>
                  <Avatar name={member.name} src={member.avatarUrl ?? undefined} size="xs" />
                  <span className={styles.eventCopy}>
                    <Text as="span" variant="subheadline">
                      <Text as="span" variant="subheadline" weight="medium">
                        {member.name.split(" ")[0]}
                      </Text>{" "}
                      {event.action}
                    </Text>
                    <Text as="span" variant="footnote" tone="secondary">
                      {shortStamp(event.at)}
                    </Text>
                  </span>
                </li>
              ))}
            </ol>
          </ProfileSection>
        </>
      )}
    </Profile>
  );
}
