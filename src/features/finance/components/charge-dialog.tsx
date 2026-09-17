"use client";

import { ArrowCounterClockwiseIcon, CheckCircleIcon, CopyIcon, LinkIcon, PaperPlaneTiltIcon, XIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { chargeMethods, chargeStatuses, dueLabel, dueTone, installmentLabel, installmentStatuses, longDate, momentLabel, shortDate } from "../labels";
import { chargeOpen, chargeReceived, chargeStatusOf, installmentStatusOf, nextInstallment, type Charge, type ChargeEvent, type Installment } from "../summary";
import { ChargeMenu, type ChargeMenuActions } from "./charge-menu";
import styles from "./charge-dialog.module.css";

export type ChargeDialogProps = ChargeMenuActions & {
  charge: Charge | null;
  onClose: () => void;
  /** Confirma o pagamento de uma parcela, ou desfaz. */
  onPay?: (installment: Installment) => void;
  onReopen?: (installment: Installment) => void;
  /** A parcela que está sendo confirmada agora, para o botão girar. */
  busyInstallment?: string | null;
};

const eventLabels: Record<ChargeEvent["kind"], string> = {
  created: "criou a cobrança",
  sent: "enviou por e-mail",
  resent: "reenviou por e-mail",
  viewed: "abriu o link",
  reported: "avisou o pagamento",
  paid: "confirmou o pagamento",
  reopened: "reabriu a parcela",
  cancelled: "cancelou a cobrança",
};

// A ficha da cobrança (2026-09-15): a `Dialog` `lg` com o título, o identificador, a situação e o cliente em
// cima; os quatro números (total, recebido, em aberto, próxima parcela) com a barra do que entrou; as
// parcelas, uma por linha, com o vencimento, o valor, a situação e o botão de confirmar ou reabrir; a forma
// de pagar com as instruções e o link do cliente para copiar e enviar; as observações; e a linha do tempo. No
// celular as ações moram na barra flutuante.
export function ChargeDialog({ charge, onClose, ...rest }: ChargeDialogProps) {
  return (
    <Dialog open={Boolean(charge)} onClose={onClose} label={charge ? `Cobrança ${charge.reference}` : "Cobrança"} size="lg" focusOnOpen={false}>
      {charge && <ChargeDetail key={charge.id} charge={charge} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

function ChargeDetail({ charge, onClose, onSend, onCopyLink, onCancel, onPay, onReopen, busyInstallment }: Omit<ChargeDialogProps, "charge"> & { charge: Charge }) {
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const status = chargeStatuses[chargeStatusOf(charge)];
  const method = chargeMethods[charge.method];
  const received = chargeReceived(charge);
  const open = chargeOpen(charge);
  const next = nextInstallment(charge);
  const active = !charge.cancelledAt && open > 0;
  const events = [...charge.events].sort((a, b) => b.at.localeCompare(a.at));

  const copyInfo = async () => {
    try {
      await navigator.clipboard.writeText(charge.paymentInfo);
      toast({ title: "Copiado", description: "As instruções de pagamento estão na área de transferência.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: "Selecione o texto e copie à mão.", tone: "warning" });
    }
  };

  useFloatingActionsRegistration(
    mobile
      ? {
          primary: active && onSend ? { label: charge.sentAt ? "Reenviar" : "Enviar", icon: <PaperPlaneTiltIcon weight="bold" />, onClick: onSend } : undefined,
          extras: onCopyLink ? [{ label: "Copiar link do cliente", icon: <LinkIcon weight="bold" />, onClick: onCopyLink }] : [],
          cancel: { label: "Fechar cobrança", onClick: onClose },
        }
      : null,
  );

  return (
    <div className={styles.dialog}>
      <header className={styles.top}>
        <nav className={styles.route} aria-label="Onde a cobrança mora">
          <Link href="/cobrancas" className={styles.crumb}>
            Cobranças
          </Link>
          {charge.client.id && (
            <>
              <span className={styles.slash} aria-hidden="true">
                /
              </span>
              <Link href={`/clientes/${charge.client.id}` as Route} className={styles.crumb}>
                {charge.client.company ?? charge.client.name}
              </Link>
            </>
          )}
          <Badge tone="neutral" variant="soft" size="sm" className={styles.reference}>
            {charge.reference}
          </Badge>
        </nav>
        <div className={styles.actions}>
          {active && onSend && (
            <IconButton label={charge.sentAt ? "Reenviar por e-mail" : "Enviar por e-mail"} size="sm" radius="md" onClick={onSend}>
              <PaperPlaneTiltIcon />
            </IconButton>
          )}
          {onCopyLink && (
            <IconButton label="Copiar link do cliente" variant="outline" size="sm" radius="md" onClick={onCopyLink}>
              <LinkIcon />
            </IconButton>
          )}
          <ChargeMenu charge={charge} onSend={onSend} onCopyLink={onCopyLink} onCancel={onCancel} />
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        <section className={styles.hero}>
          <div className={styles.heading}>
            <span className={styles.titleRow}>
              <Text as="h2" variant="title3" weight="semibold">
                {charge.title}
              </Text>
              <Badge tone={status.tone} size="sm" icon={<status.icon />}>
                {status.label}
              </Badge>
            </span>
            {charge.description && (
              <Text variant="footnote" tone="secondary">
                {charge.description}
              </Text>
            )}
          </div>
          <div className={styles.client}>
            <Avatar name={charge.client.name} src={charge.client.avatarUrl ?? undefined} size="md" shape="squircle" />
            <span className={styles.clientCopy}>
              <Text as="span" variant="footnote" weight="semibold" truncate>
                {charge.client.company ?? charge.client.name}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {charge.client.company ? `${charge.client.name}, ` : ""}
                {charge.client.email ?? "sem e-mail"}
              </Text>
            </span>
          </div>
        </section>

        <section className={styles.facts} aria-label="Números da cobrança">
          <Fact label="Total" value={formatMoney(charge.amount)} caption={charge.installments.length > 1 ? `${charge.installments.length} parcelas` : "Parcela única"} />
          <Fact label="Recebido" value={formatMoney(received)} caption={`${charge.installments.filter((installment) => installment.paidAt).length} de ${charge.installments.length} pagas`} tone="success" />
          <Fact label="Em aberto" value={formatMoney(open)} caption={charge.cancelledAt ? "Cancelada" : open === 0 ? "Nada a receber" : `${charge.installments.filter((installment) => !installment.paidAt).length} por pagar`} tone={chargeStatusOf(charge) === "overdue" ? "danger" : undefined} />
          <Fact label="Próxima parcela" value={next ? shortDate(next.dueDate) : "Nenhuma"} caption={next ? dueLabel(next.dueDate) : "Tudo em dia"} tone={next ? dueTone(next.dueDate) : undefined} />
        </section>
        <Progress value={received} max={charge.amount} size="sm" tone={chargeStatusOf(charge) === "overdue" ? "danger" : "success"} aria-label={`Recebido ${formatMoney(received)} de ${formatMoney(charge.amount)}`} />

        <section className={styles.section} aria-label="Parcelas">
          <Text as="h3" variant="subheadline" weight="semibold">
            Parcelas
          </Text>
          <ul className={styles.installments}>
            {charge.installments.map((installment) => {
              const state = installmentStatusOf(installment, charge);
              const meta = installmentStatuses[state];
              const busy = busyInstallment === installment.id;
              return (
                <li key={installment.id} className={styles.installment} data-status={state} {...squircle("md")}>
                  <span className={styles.installmentNumber} aria-hidden="true">
                    {installment.number}
                  </span>
                  <span className={styles.installmentCopy}>
                    <Text as="span" variant="footnote" weight="medium">
                      {installmentLabel(installment.number, charge.installments.length)}
                    </Text>
                    <Text as="span" variant="caption1" tone="secondary">
                      {installment.paidAt ? `Paga em ${longDate(installment.paidAt.slice(0, 10))}${installment.paidMethod ? `, ${chargeMethods[installment.paidMethod].label}` : ""}` : `Vence em ${longDate(installment.dueDate)}`}
                      {installment.reported && !installment.paidAt ? ". O cliente avisou que pagou" : ""}
                    </Text>
                  </span>
                  <span className={styles.installmentEnd}>
                    <Text as="span" variant="footnote" weight="semibold" numeric>
                      {formatMoney(installment.amount)}
                    </Text>
                    <Badge tone={installment.reported && !installment.paidAt ? "info" : meta.tone} size="sm">
                      {installment.reported && !installment.paidAt ? "Avisada" : meta.label}
                    </Badge>
                  </span>
                  {!charge.cancelledAt && (installment.paidAt ? (
                    onReopen && (
                      <IconButton label={`Reabrir a parcela ${installment.number}`} variant="ghost" size="sm" radius="md" loading={busy} onClick={() => onReopen(installment)}>
                        <ArrowCounterClockwiseIcon />
                      </IconButton>
                    )
                  ) : (
                    onPay && (
                      <span className={styles.installmentAction}>
                        <span className={styles.wide}>
                          <Button variant={installment.reported ? "primary" : "outline"} size="sm" radius="md" iconStart={<CheckCircleIcon />} loading={busy} onClick={() => onPay(installment)}>
                            Confirmar
                          </Button>
                        </span>
                        <span className={styles.narrow}>
                          <IconButton label={`Confirmar o pagamento da parcela ${installment.number}`} variant={installment.reported ? "primary" : "outline"} size="sm" radius="md" loading={busy} onClick={() => onPay(installment)}>
                            <CheckCircleIcon />
                          </IconButton>
                        </span>
                      </span>
                    )
                  ))}
                </li>
              );
            })}
          </ul>
        </section>

        <div className={styles.columns}>
          <section className={styles.section} aria-label="Como pagar">
            <Text as="h3" variant="subheadline" weight="semibold">
              Como o cliente paga
            </Text>
            <div className={styles.payment} {...squircle("md")}>
              <span className={styles.paymentHead}>
                <method.icon aria-hidden="true" />
                <Text as="span" variant="footnote" weight="semibold">
                  {method.label}
                </Text>
                {charge.paymentInfo && (
                  <IconButton label="Copiar as instruções" variant="ghost" size="sm" onClick={() => void copyInfo()}>
                    <CopyIcon />
                  </IconButton>
                )}
              </span>
              <Text variant="footnote" tone="secondary" className={styles.paymentInfo}>
                {charge.paymentInfo || "Sem instruções escritas. O cliente vê só a forma."}
              </Text>
              <Text variant="caption1" tone="tertiary">
                {charge.sentAt ? `Enviada por e-mail em ${momentLabel(charge.sentAt)}.` : "Ainda não foi enviada ao cliente."} {charge.viewedAt ? `Aberta em ${momentLabel(charge.viewedAt)}.` : ""}
              </Text>
            </div>
            {charge.notes && (
              <Text variant="footnote" tone="secondary">
                {charge.notes}
              </Text>
            )}
          </section>

          <section className={styles.section} aria-label="Linha do tempo">
            <Text as="h3" variant="subheadline" weight="semibold">
              Linha do tempo
            </Text>
            <ol className={styles.events}>
              {events.map((entry) => (
                <li key={entry.id} className={styles.event}>
                  <span className={styles.eventDot} data-kind={entry.kind} aria-hidden="true" />
                  <span className={styles.eventCopy}>
                    <Text as="span" variant="footnote">
                      <strong>{entry.actor ?? "O sistema"}</strong> {eventLabels[entry.kind]}
                      {entry.detail ? `: ${entry.detail}` : ""}
                    </Text>
                    <Text as="span" variant="caption1" tone="tertiary">
                      {momentLabel(entry.at)}
                    </Text>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: BadgeTone }) {
  return (
    <div className={styles.fact} data-tone={tone} {...squircle("md")}>
      <Text as="span" variant="caption1" tone="secondary">
        {label}
      </Text>
      <Text as="span" variant="headline" weight="semibold" numeric truncate>
        {value}
      </Text>
      <Text as="span" variant="caption1" tone="tertiary" truncate>
        {caption}
      </Text>
    </div>
  );
}
