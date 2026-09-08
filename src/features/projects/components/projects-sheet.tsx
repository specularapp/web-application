import type { Icon } from "@phosphor-icons/react";
import { BriefcaseIcon, BuildingsIcon, CheckCircleIcon, RocketLaunchIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { squircle } from "@/lib/corners";
import type { ProjectsSummary } from "../summary";
import styles from "./projects-sheet.module.css";

export type ProjectsSheetProps = { summary: ProjectsSummary };

const SHOWN_CLIENTS = 5;

/* O azulejo de cada número no raio `md` da casa, recortado no fallback porque não tem borda. */
const tileCorner = squircle("md", { clip: true });

const number = new Intl.NumberFormat("pt-BR");

/** "set. 2026", o mesmo formato curto de data do resto da aplicação. */
function monthLabel(month: string) {
  const name = format(parseISO(`${month}-01`), "MMM. yyyy", { locale: ptBR });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function Tile({ icon: Glyph, label, value }: { icon: Icon; label: string; value: string }) {
  return (
    <div className={styles.tile} {...tileCorner}>
      <Glyph aria-hidden="true" className={styles.tileIcon} />
      <Text as="dd" variant="title2" weight="semibold" numeric className={styles.tileValue}>
        {value}
      </Text>
      <Text as="dt" variant="caption1" tone="secondary">
        {label}
      </Text>
    </div>
  );
}

// As métricas de projetos em janela, o que o gráfico do bloco mostra em forma e aqui em número: os
// quatro totais em azulejo, os clientes atendidos e, embaixo, mês a mês com as duas séries em barra e o
// número de cada uma. As barras são proporcionais ao maior mês do período, e não a cada linha, senão um
// mês fraco encheria a barra igual a um mês forte e a comparação entre linhas se perderia. Server
// Component com CSS Module: quem abre é o bloco, que passa o resumo pronto.
export function ProjectsSheet({ summary }: ProjectsSheetProps) {
  const started = summary.months.reduce((total, month) => total + month.started, 0);
  const completed = summary.months.reduce((total, month) => total + month.completed, 0);
  const peak = Math.max(1, ...summary.months.map((month) => Math.max(month.started, month.completed)));
  const months = [...summary.months].reverse();

  return (
    <div className={styles.sheet}>
      <header className={styles.head}>
        <Text as="h2" variant="title2" weight="semibold">
          Projetos
        </Text>
        <Text variant="footnote" tone="secondary">
          Todos os projetos da sua equipe nos últimos {summary.months.length} meses
        </Text>
      </header>

      <dl className={styles.tiles}>
        <Tile icon={BriefcaseIcon} label="Projetos" value={number.format(summary.total)} />
        <Tile icon={BuildingsIcon} label="Clientes" value={number.format(summary.clientCount)} />
        <Tile icon={RocketLaunchIcon} label="Iniciados" value={number.format(started)} />
        <Tile icon={CheckCircleIcon} label="Entregues" value={number.format(completed)} />
      </dl>

      {summary.clients.length > 0 && (
        <section className={styles.section}>
          <Text as="h3" variant="callout" weight="semibold">
            Quem a equipe atende
          </Text>
          <div className={styles.clients}>
            <AvatarGroup>
              {summary.clients.slice(0, SHOWN_CLIENTS).map((client) => (
                <Avatar key={client.name} name={client.name} src={client.avatarUrl ?? undefined} size="sm" />
              ))}
            </AvatarGroup>
            <Text as="p" variant="footnote" tone="secondary" truncate>
              {number.format(summary.clientCount)} clientes ao todo
            </Text>
          </div>
        </section>
      )}

      <hr className={styles.rule} />

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <Text as="h3" variant="callout" weight="semibold">
            Mês a mês
          </Text>
          {/* A legenda uma vez só, no topo, porque as cores se repetem em toda linha da lista. */}
          <div className={styles.legend}>
            <span className={styles.key} data-series="started">
              <span className={styles.dot} aria-hidden="true" />
              <Text as="span" variant="caption1" tone="secondary">
                Iniciados
              </Text>
            </span>
            <span className={styles.key} data-series="completed">
              <span className={styles.dot} aria-hidden="true" />
              <Text as="span" variant="caption1" tone="secondary">
                Entregues
              </Text>
            </span>
          </div>
        </div>

        <ul className={styles.months}>
          {months.map((month) => (
            <li key={month.month} className={styles.month}>
              <Text as="span" variant="footnote" weight="medium" className={styles.monthName}>
                {monthLabel(month.month)}
              </Text>

              <span className={styles.bars} aria-hidden="true">
                <span
                  className={styles.bar}
                  data-series="started"
                  style={{ "--fill": `${(month.started / peak) * 100}%` } as CSSProperties}
                />
                <span
                  className={styles.bar}
                  data-series="completed"
                  style={{ "--fill": `${(month.completed / peak) * 100}%` } as CSSProperties}
                />
              </span>

              <span className={styles.values}>
                <Text as="span" variant="subheadline" weight="semibold" numeric className={styles.value} data-series="started">
                  {month.started}
                </Text>
                <Text as="span" variant="subheadline" weight="semibold" numeric className={styles.value} data-series="completed">
                  {month.completed}
                </Text>
              </span>

              <VisuallyHidden>
                {monthLabel(month.month)}: {month.started} projetos iniciados e {month.completed} entregues
              </VisuallyHidden>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
