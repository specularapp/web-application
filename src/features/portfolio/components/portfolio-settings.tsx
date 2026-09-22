"use client";

import { callAction } from "@/lib/action";

import { ArrowSquareOutIcon, BriefcaseIcon, CopySimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/link";
import { setProjectPublicAction } from "@/features/projects/actions";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { projectStatuses } from "@/features/projects/labels";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "@/features/settings/components/settings-page";
import styles from "@/features/settings/components/settings.module.css";
import type { PortfolioSettings as PortfolioData } from "../service";

/**
 * O portfólio, do lado de dentro (2026-09-17): o endereço da vitrine e a lista de projetos com o
 * interruptor de público em cada um. O que a vitrine mostra de cada projeto é o cartão dele, sem cliente,
 * valor nem prazo; ligar aqui é a mesma coisa que o interruptor "Projeto público" da ficha, só que para todos
 * de uma vez, que é como se monta uma vitrine.
 */
export function PortfolioSettings({ publicUrl, shown: initialShown, projects: initial, ai }: PortfolioData & { ai: AiUsage }) {
  const { toast } = useToast();
  const [projects, setProjects] = useState(initial);
  const shown = projects.filter((project) => project.isPublic).length;

  const toggle = async (id: string, isPublic: boolean) => {
    const previous = projects;
    setProjects((current) => current.map((project) => (project.id === id ? { ...project, isPublic } : project)));
    const result = await callAction(setProjectPublicAction({ id, isPublic }));
    if (!result.ok) {
      setProjects(previous);
      toast({ title: "Não deu para mudar", description: result.error, tone: "danger" });
      return;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado", description: publicUrl, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: publicUrl, tone: "warning" });
    }
  };

  return (
    <SettingsPage ai={ai}
      aside={
        <Badge tone={shown > 0 ? "success" : "neutral"} size="sm">
          {shown} {shown === 1 ? "projeto na vitrine" : "projetos na vitrine"}
        </Badge>
      }
    >
      <SettingsSection title="Endereço">
        <div className={styles.code}>
          <code>{publicUrl}</code>
          <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy()}>
            Copiar
          </Button>
          <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={publicUrl} target="_blank" rel="noreferrer">
            Abrir
          </Button>
        </div>
        <Text variant="footnote" tone="secondary">
          Quer um endereço seu? Aponte um domínio em <TextLink href="/configuracoes/dominio">Domínio</TextLink>.
        </Text>
      </SettingsSection>

      <SettingsSection title="Projetos">
        {projects.length === 0 ? (
          <EmptyState icon={BriefcaseIcon} size="sm" title="Nenhum projeto ainda" description="A vitrine mostra os projetos que você marcar como públicos.">
            <Button size="sm" radius="md" iconStart={<PlusIcon />} href="/projetos/novo">
              Criar projeto
            </Button>
          </EmptyState>
        ) : (
          <div className={styles.picks}>
            {projects.map((project) => (
              <div key={project.id} className={styles.pick}>
                <ProjectMark size="md" project={{ id: project.id, name: project.name, hue: project.hue, logoUrl: project.logoUrl, client: null }} />
                <span className={styles.rowCopy}>
                  <span className={styles.rowLine}>
                    <Text as="span" variant="subheadline" weight="medium" truncate>
                      {project.name}
                    </Text>
                    <Badge tone={projectStatuses[project.status].tone} size="sm">
                      {projectStatuses[project.status].label}
                    </Badge>
                  </span>
                  <Text as="span" variant="footnote" tone="secondary" truncate>
                    {project.client ? (project.client.company ?? project.client.name) : "Projeto independente"}
                    {project.description ? `, ${project.description}` : ""}
                  </Text>
                </span>
                <Switch size="sm" checked={project.isPublic} aria-label={`${project.isPublic ? "Tirar" : "Colocar"} ${project.name} na vitrine`} onChange={(event) => void toggle(project.id, event.target.checked)} />
              </div>
            ))}
          </div>
        )}
        {initialShown !== shown && (
          <Text variant="caption1" tone="secondary">
            A vitrine já mudou. O que está aqui é o que quem abrir o link vê agora.
          </Text>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
