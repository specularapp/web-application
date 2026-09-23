import Image from "next/image";
import { CalendarBlankIcon, CheckCircleIcon, ClockIcon, EnvelopeSimpleIcon, GlobeIcon, MapPinIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";
import { stageIcon } from "@/features/tasks/stages";
import { projectStatuses } from "../labels";
import type { PublicProjectTracking } from "../tracking";
import styles from "./project-tracking-public.module.css";

export type ProjectTrackingPublicProps = { tracking: PublicProjectTracking };

const longDate = (value: string) => format(parseISO(value), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
const shortDate = (value: string) => format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });

export function ProjectTrackingPublic({ tracking }: ProjectTrackingPublicProps) {
  const { project, organization, stages } = tracking;
  const status = projectStatuses[project.status];
  const taskCurrent = stages.findIndex((stage) => stage.kind === "ongoing" && stage.taskCount > 0);
  const progressCurrent = stages.length > 0 ? Math.min(stages.length - 1, Math.floor((project.progress / 100) * stages.length)) : -1;
  const currentIndex = taskCurrent >= 0 ? taskCurrent : progressCurrent;
  const currentStage = stages[Math.max(0, currentIndex)] ?? null;
  const hasCurrent = project.progress > 0 && project.progress < 100 && currentIndex >= 0;
  const place = [organization.city, organization.state].filter(Boolean).join(" · ");

  return (
    <main className={styles.page} style={{ "--project-hue": `var(--sys-${project.hue})` } as React.CSSProperties}>
      <div className={styles.shell}>
        <header className={styles.brand}>
          <div>
            {organization.logoUrl ? <Image src={organization.logoUrl} alt="" width={36} height={36} className={styles.brandLogo} unoptimized /> : <span className={styles.brandFallback}>{organization.name.slice(0, 1).toUpperCase()}</span>}
            <strong>{organization.name}</strong>
          </div>
          <Badge tone={status.tone} icon={<status.icon weight="fill" />}>{status.label}</Badge>
        </header>

        <Surface as="section" tone="raised" pad="loose" className={styles.summary}>
          <div className={styles.reference}><span>Projeto</span><strong>{project.reference}</strong></div>
          <div className={styles.projectHead}>
            {project.logoUrl ? <Image src={project.logoUrl} alt="" width={56} height={56} className={styles.projectLogo} unoptimized /> : <span className={styles.projectFallback}>{project.name.slice(0, 1).toUpperCase()}</span>}
            <div><h1>{project.name}</h1>{project.clientName && <p>Entrega para {project.clientName}</p>}</div>
          </div>
          <div className={styles.delivery}>
            <span>{project.progress >= 100 ? "Entrega concluída" : "Previsão da entrega"}</span>
            <strong>{project.dueAt ? longDate(project.dueAt) : "Data a definir"}</strong>
            <p>{project.progress >= 100 ? "O projeto passou por todas as etapas previstas." : currentStage ? `${currentStage.name} está ${hasCurrent ? "em andamento" : "na sequência do processo"}.` : "A equipe está organizando as próximas etapas."}</p>
          </div>

          <div className={styles.journeyScroll} aria-label="Etapas do projeto">
            <ol className={styles.journey}>
              {stages.map((stage, index) => {
                const complete = project.progress >= 100 || stage.kind === "done" || index < currentIndex;
                const current = hasCurrent && index === currentIndex;
                const Icon = complete ? CheckCircleIcon : stageIcon({ glyph: stage.glyph });
                return (
                  <li key={`${stage.position}:${stage.name}`} data-complete={complete || undefined} data-current={current || undefined}>
                    <span className={styles.stepIcon} style={{ "--stage-hue": `var(--sys-${stage.hue})` } as React.CSSProperties}><Icon weight={complete ? "fill" : "bold"} /></span>
                    <strong>{stage.name}</strong>
                  </li>
                );
              })}
            </ol>
          </div>
        </Surface>

        <Card title="Histórico do projeto" icon={<ClockIcon />} className={styles.card}>
          <ol className={styles.timeline}>
            {stages.map((stage, index) => {
              const complete = project.progress >= 100 || stage.kind === "done" || index < currentIndex;
              const current = hasCurrent && index === currentIndex;
              const Icon = complete ? CheckCircleIcon : stageIcon({ glyph: stage.glyph });
              return (
                <li key={`${stage.position}:${stage.name}`} data-complete={complete || undefined} data-current={current || undefined}>
                  <span className={styles.timelineRail}><span style={{ "--stage-hue": `var(--sys-${stage.hue})` } as React.CSSProperties}><Icon weight={complete ? "fill" : "bold"} /></span></span>
                  <div><strong>{stage.name}</strong><span>{current ? "Em andamento" : complete ? "Concluída" : "Próxima etapa"}</span>{stage.taskCount > 0 && <small>{stage.taskCount} {stage.taskCount === 1 ? "atividade prevista" : "atividades previstas"}</small>}</div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className={styles.details}>
          <Card title="Detalhes da entrega" icon={<CalendarBlankIcon />} className={styles.card}>
            <dl className={styles.facts}>
              <div><dt>Andamento</dt><dd>{project.progress}%</dd></div>
              <div><dt>Início</dt><dd>{shortDate(project.startedAt)}</dd></div>
              <div><dt>Previsão</dt><dd>{project.dueAt ? shortDate(project.dueAt) : "A definir"}</dd></div>
              <div><dt>Atualização</dt><dd>{shortDate(project.updatedAt)}</dd></div>
            </dl>
            <div className={styles.progressTrack} role="progressbar" aria-label="Andamento do projeto" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${project.progress}%` }} /></div>
          </Card>

          <Card title="Sobre o projeto" icon={<GlobeIcon />} className={styles.card}>
            <p className={styles.description}>{project.description || "A equipe está organizando os detalhes desta entrega."}</p>
            {(organization.email || organization.website || place) && <div className={styles.contacts}>
              {place && <span><MapPinIcon />{place}</span>}
              {organization.email && <a href={`mailto:${organization.email}`}><EnvelopeSimpleIcon />Falar com a equipe</a>}
              {organization.website && <a href={organization.website} target="_blank" rel="noreferrer"><GlobeIcon />Visitar o site</a>}
            </div>}
          </Card>
        </div>

        <footer>Atualização compartilhada por {organization.name}</footer>
      </div>
    </main>
  );
}
