"use client";

import { CopyIcon, CursorClickIcon, EnvelopeOpenIcon, EnvelopeSimpleIcon, PaperPlaneTiltIcon, PercentIcon, ProhibitIcon, ArrowUUpLeftIcon, WarningIcon, type Icon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TableScroll } from "@/components/ui/table";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { EMAIL_BENCHMARK, EMAIL_HOURS, emailRates, formatCount, formatLongWhen, formatRate, ratio } from "../email-catalog";
import type { ContactList, EmailCampaign, EmailStats } from "../types";
import { EmailPreview } from "./email-preview";
import styles from "./email-report.module.css";

export type EmailReportProps = {
  campaign: EmailCampaign | null;
  lists: ContactList[];
  onClose: () => void;
  onDuplicate: (campaign: EmailCampaign) => void;
};

const percent = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const EMPTY_STATS: EmailStats = { recipients: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0, spam: 0, links: [], hourly: [] };

// O relatório de um envio, numa janela de trabalho: o destaque com a taxa de abertura e os medidores contra a
// referência do mercado, os oito indicadores, a curva de aberturas nas horas depois do envio, até onde cada
// pessoa foi, os links clicados e o e-mail como saiu. Os números são de exemplo até o provedor mandar os eventos.
export function EmailReport({ campaign, lists, onClose, onDuplicate }: EmailReportProps) {
  return (
    <Dialog open={campaign !== null} onClose={onClose} label={campaign ? `Relatório de ${campaign.name}` : "Relatório do e-mail"} size="xl" surface="workspace">
      {campaign && <ReportBody campaign={campaign} lists={lists} onClose={onClose} onDuplicate={onDuplicate} />}
    </Dialog>
  );
}

function ReportBody({ campaign, lists, onClose, onDuplicate }: Omit<EmailReportProps, "campaign"> & { campaign: EmailCampaign }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  useFloatingActionsRegistration(mobile ? { primary: { label: "Duplicar e reenviar", icon: <CopyIcon weight="bold" />, onClick: () => onDuplicate(campaign) }, cancel: { label: "Fechar", onClick: onClose } } : null);

  const stats = campaign.stats ?? EMPTY_STATS;
  const rates = emailRates(stats);
  const audience = lists.filter((list) => campaign.audience.includes(list.id)).map((list) => list.name);
  const fresh = stats.opens === 0;
  const peak = Math.max(1, ...stats.hourly);
  const linkTotal = stats.links.reduce((sum, link) => sum + link.clicks, 0);
  const onlyOpened = Math.max(0, stats.opens - stats.clicks);
  const notOpened = Math.max(0, stats.delivered - stats.opens);

  const kpis: { id: string; label: string; value: string; caption: string; icon: Icon; hue: string }[] = [
    { id: "enviados", label: "Enviados", value: formatCount(stats.recipients), caption: audience.join(", ") || "Sem público", icon: PaperPlaneTiltIcon, hue: "var(--sys-blue)" },
    { id: "entregues", label: "Entregues", value: percent(rates.delivered), caption: `${formatCount(stats.delivered)} caixas`, icon: EnvelopeSimpleIcon, hue: "var(--sys-green)" },
    { id: "aberturas", label: "Aberturas únicas", value: formatCount(stats.opens), caption: `${formatRate(stats.opens, stats.delivered)} dos entregues`, icon: EnvelopeOpenIcon, hue: "var(--sys-orange)" },
    { id: "cliques", label: "Cliques únicos", value: formatCount(stats.clicks), caption: `${formatRate(stats.clicks, stats.delivered)} dos entregues`, icon: CursorClickIcon, hue: "var(--sys-purple)" },
    { id: "ctor", label: "Clique por abertura", value: percent(rates.ctor), caption: "Cliques sobre quem abriu", icon: PercentIcon, hue: "var(--sys-pink)" },
    { id: "descadastros", label: "Descadastros", value: formatCount(stats.unsubscribes), caption: `${percent(rates.unsubscribes)} dos entregues`, icon: ProhibitIcon, hue: "var(--sys-teal)" },
    { id: "devolvidos", label: "Devolvidos", value: formatCount(stats.bounces), caption: `${percent(rates.bounces)} dos enviados`, icon: ArrowUUpLeftIcon, hue: "var(--sys-blue)" },
    { id: "spam", label: "Marcados como spam", value: formatCount(stats.spam), caption: `${percent(rates.spam)} dos entregues`, icon: WarningIcon, hue: "var(--sys-green)" },
  ];

  const gauges = [
    { id: "abertura", label: "Abertura", value: rates.opens, target: EMAIL_BENCHMARK.opens },
    { id: "clique", label: "Clique", value: rates.clicks, target: EMAIL_BENCHMARK.clicks },
    { id: "ctor", label: "Clique por abertura", value: rates.ctor, target: EMAIL_BENCHMARK.ctor },
  ];

  const reach = [
    { id: "clicou", label: "Abriu e clicou", value: stats.clicks, hue: "var(--sys-blue)" },
    { id: "abriu", label: "Só abriu", value: onlyOpened, hue: "var(--sys-green)" },
    { id: "nao", label: "Não abriu", value: notOpened, hue: "var(--color-fill)" },
  ];

  return (
    <div className={styles.report}>
      <DialogHeader
        title={campaign.name}
        description={campaign.sentAt ? `Enviado em ${formatLongWhen(campaign.sentAt)}` : "Envio em andamento"}
        scale="record"
        onClose={onClose}
        actions={
          <span className={styles.wide}>
            <Button size="sm" radius="md" variant="outline" iconStart={<CopyIcon />} onClick={() => onDuplicate(campaign)}>
              Duplicar e reenviar
            </Button>
          </span>
        }
      />

      <div className={styles.body}>
        <div className={styles.main}>
          {fresh && (
            <p className={styles.fresh} role="status">
              Acabou de sair: aberturas e cliques chegam ao longo das próximas horas, conforme o provedor informa.
            </p>
          )}

          <section className={styles.highlight} aria-labelledby="report-highlight">
            <div className={styles.headline}>
              <Text as="h3" id="report-highlight" variant="footnote" tone="secondary" weight="medium">
                Taxa de abertura
              </Text>
              <span className={styles.big}>{percent(rates.opens)}</span>
              <Text variant="caption1" tone="secondary">
                {formatCount(stats.opens)} de {formatCount(stats.delivered)} entregues abriram
              </Text>
            </div>
            <ul className={styles.gauges}>
              {gauges.map((gauge) => {
                const scale = Math.max(gauge.value, gauge.target) * 1.25 || 1;
                return (
                  <li key={gauge.id} className={styles.gauge} data-above={gauge.value >= gauge.target || undefined}>
                    <span className={styles.gaugeHead}>
                      <span>{gauge.label}</span>
                      <strong>{percent(gauge.value)}</strong>
                    </span>
                    <span className={styles.meter} aria-hidden="true">
                      <i style={{ width: `${(gauge.value / scale) * 100}%` }} />
                      <b style={{ left: `${(gauge.target / scale) * 100}%` }} />
                    </span>
                    <small>Referência do mercado: {percent(gauge.target)}</small>
                  </li>
                );
              })}
            </ul>
          </section>

          <ul className={styles.kpis}>
            {kpis.map(({ id, label, value, caption, icon: Glyph, hue }) => (
              <li key={id} className={styles.kpi} style={{ "--hue": hue } as CSSProperties}>
                <span className={styles.kpiHead}>
                  <span className={styles.kpiGlyph} aria-hidden="true">
                    <Glyph weight="duotone" />
                  </span>
                  {label}
                </span>
                <strong className={styles.kpiValue}>{value}</strong>
                <small className={styles.kpiCaption}>{caption}</small>
              </li>
            ))}
          </ul>

          <div className={styles.band}>
            <section className={styles.card} aria-labelledby="report-hours">
              <header className={styles.cardHead}>
                <Text as="h3" id="report-hours" variant="subheadline" weight="semibold">
                  Depois do envio
                </Text>
                <Text variant="caption1" tone="secondary">
                  Aberturas em cada faixa de horas
                </Text>
              </header>
              <ol className={styles.hours} aria-label="Aberturas por faixa de horas">
                {EMAIL_HOURS.map((label, index) => {
                  const value = stats.hourly[index] ?? 0;
                  return (
                    <li key={label} className={styles.hour}>
                      <span className={styles.hourBar} aria-hidden="true">
                        <i style={{ height: `${(value / peak) * 100}%` }} />
                      </span>
                      <small>{label}</small>
                      <VisuallyHidden>{`${formatCount(value)} aberturas até ${label}`}</VisuallyHidden>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={styles.card} aria-labelledby="report-reach">
              <header className={styles.cardHead}>
                <Text as="h3" id="report-reach" variant="subheadline" weight="semibold">
                  Quem recebeu
                </Text>
                <Text variant="caption1" tone="secondary">
                  Dos entregues, até onde cada um foi
                </Text>
              </header>
              <span className={styles.stack} aria-hidden="true">
                {reach.map((item) => (
                  <i key={item.id} style={{ width: `${ratio(item.value, stats.delivered)}%`, "--hue": item.hue } as CSSProperties} />
                ))}
              </span>
              <ul className={styles.legend}>
                {reach.map((item) => (
                  <li key={item.id} style={{ "--hue": item.hue } as CSSProperties}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{formatCount(item.value)}</strong>
                    <small>{formatRate(item.value, stats.delivered)}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={styles.card} aria-labelledby="report-links">
            <header className={styles.cardHead}>
              <Text as="h3" id="report-links" variant="subheadline" weight="semibold">
                Links do e-mail
              </Text>
              <Text variant="caption1" tone="secondary">
                Para onde foram os cliques
              </Text>
            </header>
            {stats.links.length === 0 ? (
              <Text variant="footnote" tone="secondary">
                Este e-mail não tem links com clique registrado.
              </Text>
            ) : (
              <TableScroll label="Links do e-mail">
                <Table density="compact">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Link</TableHeaderCell>
                      <TableHeaderCell>Endereço</TableHeaderCell>
                      <TableHeaderCell align="end">Cliques</TableHeaderCell>
                      <TableHeaderCell align="end">Dos cliques</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.links.map((link) => (
                      <TableRow key={link.url + link.label}>
                        <TableCell>{link.label}</TableCell>
                        <TableCell>
                          <span className={styles.url}>{link.url.replace(/^https?:\/\//, "")}</span>
                        </TableCell>
                        <TableCell align="end">{formatCount(link.clicks)}</TableCell>
                        <TableCell align="end">{formatRate(link.clicks, linkTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroll>
            )}
          </section>
        </div>

        <aside className={styles.side} aria-label="O e-mail como saiu">
          <Text as="h3" variant="subheadline" weight="semibold">
            O e-mail como saiu
          </Text>
          <EmailPreview subject={campaign.subject} preheader={campaign.preheader} fromName={campaign.fromName} fromEmail={campaign.fromEmail} hue={campaign.hue} blocks={campaign.blocks} size="mobile" />
        </aside>
      </div>
    </div>
  );
}
