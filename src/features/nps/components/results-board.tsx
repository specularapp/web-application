"use client";

import { ArrowRightIcon, ChartBarIcon, ChatCircleTextIcon, ChatTextIcon, GaugeIcon, LifebuoyIcon, ListChecksIcon, PaperPlaneTiltIcon, SquaresFourIcon, StarIcon, TagIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { buildDashboard, defaultNpsFilters, periodLabels, type NpsFilters, type NpsPeriod } from "../analytics";
import { channelLabels, formatCount, formatDecimal, formatNps, formatShare, groupLabels, groups, plural, serviceLabels, services, surveyStatusLabels, timeAgo, treatmentLabels, zoneOf } from "../labels";
import type { NpsData, NpsService } from "../types";
import { NpsEvolutionChart } from "./nps-evolution-chart-lazy";
import type { NpsEvolutionMode } from "./nps-evolution-chart";
import nps from "./nps.module.css";
import { NPS_BASE, NpsRing, ScoreBubble, SharesBar } from "./parts";
import styles from "./results.module.css";
import { Segmented } from "./segmented";

const periods = Object.keys(periodLabels) as NpsPeriod[];

/**
 * O painel do NPS: na primeira linha o NPS no anel das faixas, a dispersão das notas e a taxa de resposta;
 * depois a evolução mês a mês, o NPS por serviço, os aspectos avaliados em estrelas, os assuntos dos
 * comentários, as últimas respostas, as tratativas e as pesquisas no ar. As contas rodam na tela, então trocar
 * o filtro é instantâneo.
 */
export function ResultsBoard({ data }: { data: NpsData }) {
  const [filters, setFilters] = useState<NpsFilters>(defaultNpsFilters);
  const [mode, setMode] = useState<NpsEvolutionMode>("nps");
  const dashboard = useMemo(() => buildDashboard(data, filters), [data, filters]);
  const clientsById = useMemo(() => new Map(data.clients.map((client) => [client.id, client])), [data.clients]);
  const treatmentsById = useMemo(() => new Map(data.treatments.map((treatment) => [treatment.id, treatment])), [data.treatments]);
  const filtering = filters.period !== defaultNpsFilters.period || filters.surveyId !== "all" || filters.service !== "all";
  const zone = dashboard.nps === null ? null : zoneOf(dashboard.nps);
  const delta = dashboard.nps !== null && dashboard.previousNps !== null ? dashboard.nps - dashboard.previousNps : null;
  const maxTheme = Math.max(1, ...dashboard.themes.map((theme) => Math.max(theme.praise, theme.complaint)));
  const liveSurveys = data.surveys.filter((survey) => survey.status === "active" || survey.status === "paused");
  const set = <K extends keyof NpsFilters>(key: K, value: NpsFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className={nps.board}>
      <div className={styles.filters} role="group" aria-label="Filtros do painel">
        <span className={styles.filter}>
          <Select size="sm" label="Período" value={filters.period} options={periods.map((period) => ({ value: period, label: periodLabels[period] }))} onChange={(value) => set("period", value)} />
        </span>
        <span className={styles.filter}>
          <Select size="sm" label="Pesquisa" value={filters.surveyId} options={[{ value: "all", label: "Todas as pesquisas" }, ...data.surveys.map((survey) => ({ value: survey.id, label: survey.name, caption: surveyStatusLabels[survey.status].label }))]} onChange={(value) => set("surveyId", value)} />
        </span>
        <span className={styles.filter}>
          <Select<NpsService | "all"> size="sm" label="Serviço" value={filters.service} options={[{ value: "all", label: "Todos os serviços" }, ...services.map((service) => ({ value: service, label: serviceLabels[service].label }))]} onChange={(value) => set("service", value)} />
        </span>
        {filtering && (
          <Button variant="ghost" size="sm" radius="md" onClick={() => setFilters(defaultNpsFilters)}>
            Limpar filtros
          </Button>
        )}
      </div>

      {dashboard.total === 0 ? (
        <EmptyState icon={GaugeIcon} title="Nenhuma resposta neste recorte" description={filtering ? "Amplie o período ou tire o filtro de pesquisa e serviço para ver o NPS." : "Assim que os clientes responderem, o NPS aparece aqui."}>
          {filtering ? (
            <Button size="sm" radius="md" onClick={() => setFilters(defaultNpsFilters)}>
              Limpar filtros
            </Button>
          ) : (
            <Button size="sm" radius="md" iconStart={<PaperPlaneTiltIcon />} href={`${NPS_BASE}/disparos`}>
              Ver disparos
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          <div className={styles.top}>
            <Card title="NPS" icon={<GaugeIcon />} action={<Text as="span" variant="caption1" tone="secondary">{periodLabels[filters.period]}</Text>}>
              <div className={styles.npsCard}>
                <NpsRing parts={groups.map((group) => ({ value: dashboard.shares[group], color: groupLabels[group].color }))} label={`NPS ${formatNps(dashboard.nps)}${zone ? `, ${zone.label}` : ""}`}>
                  <Text as="span" variant="caption1" tone="secondary">
                    NPS
                  </Text>
                  <strong className={styles.bigNumber}>{formatNps(dashboard.nps)}</strong>
                  {zone && (
                    <Badge tone={zone.tone} size="sm">
                      {zone.label}
                    </Badge>
                  )}
                </NpsRing>
                <dl className={styles.groupStats}>
                  {groups.map((group) => (
                    <div key={group} style={{ "--group": groupLabels[group].color } as CSSProperties}>
                      <dt>{groupLabels[group].plural}</dt>
                      <dd>
                        <strong>{formatShare(dashboard.shares[group])}</strong>
                        <span>{formatCount(dashboard.counts[group])}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {delta !== null && (
                  <Text variant="caption1" tone={delta > 0 ? "success" : delta < 0 ? "danger" : "secondary"} className={styles.delta}>
                    {delta === 0 ? "Igual ao período anterior" : `${delta > 0 ? "+" : ""}${delta} pontos contra o período anterior`}
                  </Text>
                )}
              </div>
            </Card>

            <Card title="Dispersão das notas" icon={<ChartBarIcon />} action={<Text as="span" variant="caption1" tone="secondary">{plural(dashboard.total, "resposta", "respostas")}</Text>}>
              <ol className={styles.dispersion} aria-label="Respostas por nota, de 10 a 0">
                {dashboard.distribution.map((item) => {
                  const share = dashboard.total > 0 ? (item.count / dashboard.total) * 100 : 0;
                  return (
                    <li key={item.score} aria-label={`Nota ${item.score}: ${plural(item.count, "resposta", "respostas")}`}>
                      <span className={styles.dispersionScore}>{item.score}</span>
                      <span className={styles.dispersionTrack} aria-hidden="true">
                        {share > 0 && <i style={{ width: `${share}%`, "--bar": groupLabels[item.group].color } as CSSProperties} />}
                      </span>
                      <span className={styles.dispersionCount}>{formatCount(item.count)}</span>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card title="Taxa de resposta" icon={<PaperPlaneTiltIcon />} action={<Button variant="outline" size="sm" radius="md" href={`${NPS_BASE}/disparos`}>Disparos</Button>}>
              <div className={styles.npsCard}>
                <NpsRing parts={[{ value: dashboard.response.rate, color: "var(--sys-blue)" }]} label={`Taxa de resposta de ${formatShare(dashboard.response.rate)}`}>
                  <strong className={styles.bigNumber}>{formatShare(dashboard.response.rate)}</strong>
                  <Text as="span" variant="caption1" tone="secondary">
                    responderam
                  </Text>
                </NpsRing>
                <dl className={styles.rateList}>
                  <div>
                    <dt>Enviadas</dt>
                    <dd>{formatCount(dashboard.response.sent)}</dd>
                  </div>
                  <div>
                    <dt>Respondidas</dt>
                    <dd>{formatCount(dashboard.response.answered)}</dd>
                  </div>
                  <div>
                    <dt>Com comentário</dt>
                    <dd>{formatCount(dashboard.response.withComment)}</dd>
                  </div>
                  <div>
                    <dt>Sem comentário</dt>
                    <dd>{formatCount(dashboard.response.withoutComment)}</dd>
                  </div>
                </dl>
              </div>
            </Card>
          </div>

          <Card
            title="Evolução do NPS"
            icon={<ChartBarIcon />}
            action={
              <Segmented
                as="radio"
                label="O que o gráfico mostra"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "nps", label: "NPS" },
                  { value: "groups", label: "Faixas" },
                ]}
              />
            }
          >
            <div className={styles.chart}>
              <NpsEvolutionChart points={dashboard.monthly} mode={mode} />
            </div>
            {mode === "groups" && (
              <ul className={styles.legend} aria-label="Legenda">
                {groups.map((group) => (
                  <li key={group}>
                    <i style={{ "--dot": groupLabels[group].color } as CSSProperties} aria-hidden="true" />
                    {groupLabels[group].plural}
                  </li>
                ))}
              </ul>
            )}
            <ol className={styles.months} aria-label="NPS por mês" style={{ "--months": dashboard.monthly.length } as CSSProperties}>
              {dashboard.monthly.map((point) => (
                <li key={point.key}>
                  <Text as="span" variant="caption1" tone="secondary">
                    {point.label}
                  </Text>
                  <Text as="span" variant="caption1" weight="semibold">
                    {point.count === 0 ? "Sem nota" : mode === "nps" ? formatNps(point.nps) : formatShare(point.shares.promoter)}
                  </Text>
                </li>
              ))}
            </ol>
          </Card>

          <div className={styles.band}>
            <Card title="NPS por serviço" icon={<SquaresFourIcon />}>
              <ol className={styles.rank}>
                {dashboard.byService.map((item) => {
                  const itemZone = item.nps === null ? null : zoneOf(item.nps);
                  return (
                    <li key={item.service}>
                      <span className={styles.rankHead}>
                        <span className={styles.rankName}>{serviceLabels[item.service].label}</span>
                        <strong>{formatNps(item.nps)}</strong>
                        {itemZone && (
                          <Badge tone={itemZone.tone} size="sm">
                            {itemZone.label}
                          </Badge>
                        )}
                      </span>
                      <SharesBar shares={item.shares} label={groups.map((group) => `${groupLabels[group].plural} ${formatShare(item.shares[group])}`).join(", ")} />
                      <Text as="span" variant="caption1" tone="tertiary">
                        {plural(item.count, "resposta", "respostas")}
                      </Text>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card title="Aspectos avaliados" icon={<StarIcon />} action={<Text as="span" variant="caption1" tone="secondary">Média de 1 a 5</Text>}>
              {dashboard.aspects.length === 0 ? (
                <Text variant="footnote" tone="secondary" className={styles.empty}>
                  Nenhuma pergunta de estrelas respondida no período.
                </Text>
              ) : (
                <ol className={styles.rank}>
                  {dashboard.aspects.map((aspect) => {
                    const diff = aspect.previous === null ? null : Math.round((aspect.average - aspect.previous) * 10) / 10;
                    const hue = aspect.average >= 4.3 ? groupLabels.promoter.color : aspect.average >= 3.5 ? groupLabels.passive.color : groupLabels.detractor.color;
                    return (
                      <li key={aspect.label}>
                        <span className={styles.rankHead}>
                          <span className={styles.rankName}>{aspect.label}</span>
                          <strong className={styles.stars}>
                            <StarIcon weight="fill" aria-hidden="true" />
                            {formatDecimal(aspect.average)}
                          </strong>
                          {diff !== null && diff !== 0 && (
                            <Text as="span" variant="caption1" tone={diff > 0 ? "success" : "danger"}>
                              {diff > 0 ? "+" : "-"}
                              {formatDecimal(Math.abs(diff))}
                            </Text>
                          )}
                        </span>
                        <span className={styles.meter} role="img" aria-label={`${aspect.label}: ${formatDecimal(aspect.average)} de 5`}>
                          <i style={{ width: `${(aspect.average / 5) * 100}%`, "--bar": hue } as CSSProperties} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>

            <Card title="Assuntos dos comentários" icon={<TagIcon />}>
              {dashboard.themes.length === 0 ? (
                <Text variant="footnote" tone="secondary" className={styles.empty}>
                  Nenhum comentário no período.
                </Text>
              ) : (
                <>
                  <ol className={styles.themes}>
                    {dashboard.themes.map((theme) => (
                      <li key={theme.id} aria-label={`${theme.label}: ${plural(theme.complaint, "crítica", "críticas")} e ${plural(theme.praise, "elogio", "elogios")}`}>
                        <span className={styles.themeLabel}>{theme.label}</span>
                        <span className={styles.themeBars} aria-hidden="true">
                          <span data-side="complaint">
                            <small>{theme.complaint || ""}</small>
                            <i style={{ width: `${(theme.complaint / maxTheme) * 100}%` }} />
                          </span>
                          <span data-side="praise">
                            <i style={{ width: `${(theme.praise / maxTheme) * 100}%` }} />
                            <small>{theme.praise || ""}</small>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <ul className={styles.legend} aria-label="Legenda">
                    <li>
                      <i style={{ "--dot": groupLabels.detractor.color } as CSSProperties} aria-hidden="true" />
                      Críticas, notas até 8
                    </li>
                    <li>
                      <i style={{ "--dot": groupLabels.promoter.color } as CSSProperties} aria-hidden="true" />
                      Elogios, notas 9 e 10
                    </li>
                  </ul>
                </>
              )}
            </Card>
          </div>

          <div className={styles.bottom}>
            <Card title="Últimas respostas" icon={<ChatTextIcon />} action={<Button variant="outline" size="sm" radius="md" href={`${NPS_BASE}/respostas`}>Ver todas</Button>}>
              <ul className={styles.feed}>
                {dashboard.latest.map((row) => {
                  const client = clientsById.get(row.clientId);
                  const treatment = row.treatmentId ? treatmentsById.get(row.treatmentId) : null;
                  return (
                    <li key={row.id}>
                      <Link href={`${NPS_BASE}/respostas?id=${row.id}` as Route} className={styles.feedItem}>
                        <ScoreBubble score={row.score} />
                        <span className={styles.feedText}>
                          <strong>
                            {client?.contact.name ?? "Cliente"}
                            <small>{[client?.contact.company, channelLabels[row.channel]].filter(Boolean).join(" | ")}</small>
                          </strong>
                          <span>{row.comment || <em>Sem comentário</em>}</span>
                        </span>
                        <span className={styles.feedMeta}>
                          <time dateTime={row.answeredAt}>{timeAgo(row.answeredAt, data.now)}</time>
                          {treatment && (
                            <Badge tone={treatmentLabels[treatment.status].tone} size="sm">
                              {treatmentLabels[treatment.status].label}
                            </Badge>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className={styles.side}>
              <Card title="Tratativas" icon={<LifebuoyIcon />} action={<Button variant="outline" size="sm" radius="md" href={`${NPS_BASE}/tratativas`}>Abrir</Button>}>
                <dl className={styles.tiles}>
                  <div>
                    <dt>Em andamento</dt>
                    <dd>{formatCount(dashboard.treatments.open)}</dd>
                  </div>
                  <div data-tone={dashboard.treatments.late > 0 ? "danger" : undefined}>
                    <dt>Sem contato em 24 h</dt>
                    <dd>{formatCount(dashboard.treatments.late)}</dd>
                  </div>
                  <div>
                    <dt>Recuperados</dt>
                    <dd>{dashboard.treatments.closed > 0 ? formatShare((dashboard.treatments.recovered / dashboard.treatments.closed) * 100) : "Sem dado"}</dd>
                  </div>
                </dl>
              </Card>

              <Card title="Pesquisas no ar" icon={<ListChecksIcon />} action={<Button variant="outline" size="sm" radius="md" href={`${NPS_BASE}/pesquisas`}>Pesquisas</Button>}>
                <ul className={styles.surveys}>
                  {liveSurveys.map((survey) => (
                    <li key={survey.id}>
                      <Link href={`${NPS_BASE}/pesquisas/${survey.id}` as Route} className={styles.surveyLink}>
                        <span className={styles.swatch} style={{ "--swatch": survey.accent } as CSSProperties} aria-hidden="true">
                          <ChatCircleTextIcon weight="fill" />
                        </span>
                        <span className={styles.surveyText}>
                          <strong>{survey.name}</strong>
                          <small>{survey.publicLink ? "Envio e link aberto" : "Link pessoal de cada envio"}</small>
                        </span>
                        <Badge tone={surveyStatusLabels[survey.status].tone} size="sm">
                          {surveyStatusLabels[survey.status].label}
                        </Badge>
                        <ArrowRightIcon aria-hidden="true" className={styles.chevron} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
