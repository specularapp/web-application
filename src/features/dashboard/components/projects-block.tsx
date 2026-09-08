import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { DetailsTrigger } from "@/components/ui/details-dialog";
import { Text } from "@/components/ui/text";
import { ProjectsSheet } from "@/features/projects/components/projects-sheet";
import type { ProjectsSummary } from "@/features/projects/summary";
import { ProjectsChart } from "./projects-chart-lazy";
import styles from "./projects-block.module.css";

export type ProjectsBlockProps = { summary: ProjectsSummary };

const SHOWN_CLIENTS = 3;

// Resumo à esquerda (quantos projetos, para quem) e o gráfico dos últimos meses à direita. Em
// bloco estreito o gráfico desce para baixo do resumo em vez de espremer os dois. O bloco inteiro é o
// gatilho da janela de métricas (pedido de 2026-09-08): a dica do gráfico é hover, e hover não existe no
// toque, então no celular o número de cada mês não tinha como aparecer. Agora tocar em qualquer ponto do
// bloco abre a ficha com os números por extenso, no desktop também.
export function ProjectsBlock({ summary }: ProjectsBlockProps) {
  return (
    <DetailsTrigger
      as="div"
      dialog={<ProjectsSheet summary={summary} />}
      dialogLabel="Métricas de projetos"
      dialogSize="md"
      label="Ver as métricas de projetos"
      className={styles.block}
    >
      <div className={styles.summary}>
        <div className={styles.heading}>
          <Text as="p" variant="title3" weight="semibold">
            {summary.total} Projetos
          </Text>
          <Text variant="footnote" tone="secondary" className={styles.description}>
            Todos os projetos da sua equipe
          </Text>
        </div>

        <div className={styles.clients}>
          <AvatarGroup className={styles.avatars}>
            {summary.clients.slice(0, SHOWN_CLIENTS).map((client) => (
              <Avatar key={client.name} name={client.name} src={client.avatarUrl ?? undefined} size="sm" />
            ))}
          </AvatarGroup>
          <Text as="p" variant="footnote" tone="secondary" truncate className={styles.clientsLabel}>
            {summary.clientCount} Clientes
          </Text>
        </div>
      </div>

      <div className={styles.chart}>
        <ProjectsChart months={summary.months} />
      </div>
    </DetailsTrigger>
  );
}
