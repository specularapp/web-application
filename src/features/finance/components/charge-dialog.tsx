"use client";

import { ArrowCounterClockwiseIcon, ChatCircleTextIcon, CheckCircleIcon, CopyIcon, EyeIcon, LinkIcon, PaperPlaneTiltIcon, PlusCircleIcon, XCircleIcon, XIcon, type Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { Timeline } from "@/components/ui/timeline";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { formatMoney } from "@/lib/utils/format";
import { chargeDirections, chargeMethods, chargeStatuses, dueLabel, dueTone, installmentStatuses, momentLabel, partyOf, recurrenceLabels, shortDate } from "../labels";
import { chargeOpen, chargeSettled, chargeStatusOf, installmentStatusOf, nextInstallment, type Charge, type ChargeEvent, type Installment } from "../summary";
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

/* O ícone e o matiz de cada ato na linha do tempo. */
const eventMeta: Record<ChargeEvent["kind"], { icon: Icon; hue: string }> = {
  created: { icon: PlusCircleIcon, hue: "var(--sys-gray)" },
  sent: { icon: PaperPlaneTiltIcon, hue: "var(--sys-blue)" },
  resent: { icon: PaperPlaneTiltIcon, hue: "var(--sys-blue)" },
  viewed: { icon: EyeIcon, hue: "var(--sys-cyan)" },
  reported: { icon: ChatCircleTextIcon, hue: "var(--sys-orange)" },
  paid: { icon: CheckCircleIcon, hue: "var(--sys-green)" },
  reopened: { icon: ArrowCounterClockwiseIcon, hue: "var(--sys-teal)" },
  cancelled: { icon: XCircleIcon, hue: "var(--sys-red)" },
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

// A ficha da cobrança (2026-09-15, reorganizada em 2026-10-27 na janela grande do contrato): o topo com a rota
// e as ações; à esquerda o título com a situação, as parcelas com confirmar e reabrir e como pagar; à direita o
// painel com quem paga, os valores, os detalhes e a linha do tempo. No celular as ações moram na barra flutuante.
export function ChargeDialog({ charge, onClose, ...rest }: ChargeDialogProps) {
  const label = charge ? `${chargeDirections[charge.direction].label} ${charge.reference}` : "Lançamento";
  return (
    <Dialog open={Boolean(charge)} onClose={onClose} label={label} size="xl" focusOnOpen={false}>
      {charge && <ChargeDetail key={charge.id} charge={charge} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

function ChargeDetail({ charge, onClose, onSend: sendProp, onCopyLink: copyProp, onCancel, onPay, onReopen, busyInstallment }: Omit<ChargeDialogProps, "charge"> & { charge: Charge }) {
  /* Despesa não se envia nem tem link de pagador: o link existe para o cliente ver o que deve e avisar que
     pagou, e do lado de cá quem paga é a própria equipe. O banco recusa de novo, pelo
     `charges_outgoing_not_shared`; aqui as ações simplesmente não existem, em vez de existirem e falharem. */
  const side = chargeDirections[charge.direction];
  const outgoing = charge.direction === "outgoing";
  const onSend = outgoing ? undefined : sendProp;
  const onCopyLink = outgoing ? undefined : copyProp;
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const status = chargeStatuses[chargeStatusOf(charge)];
  const payer = partyOf(charge);
  const method = chargeMethods[charge.method];
  const received = chargeSettled(charge);
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
          cancel: { label: `Fechar ${side.label.toLocaleLowerCase("pt-BR")}`, onClick: onClose },
        }
      : null,
  );

  return (
    <div className={styles.dialog}>
      <header className={styles.top}>
        <nav className={styles.route} aria-label={`Onde a ${side.label.toLocaleLowerCase("pt-BR")} mora`}>
          <Link href={outgoing ? "/despesas" : "/cobrancas"} className={styles.crumb}>
            {outgoing ? "Despesas" : "Cobranças"}
          </Link>
          {payer.clientId && (
            <>
              <span className={styles.slash} aria-hidden="true">
                /
              </span>
              <Link href={`/${outgoing ? "fornecedores" : "clientes"}/${payer.clientId}` as Route} className={styles.crumb}>
                {payer.company ?? payer.name}
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

      {/* O corpo em duas colunas, como a ficha do contrato (2026-10-27, a pedido: "reorganizar melhor e otimizar
          mais"): à esquerda o que se faz (o título, as parcelas com confirmar e reabrir, e como pagar); à direita,
          num painel, quem paga, os números num bloco só, os detalhes e a linha do tempo. Os quatro azulejos e a
          barra solta saíram: viraram o bloco de valores do painel. */}
      <div className={styles.body}>
        <div className={styles.main}>
          <section className={styles.heading}>
            <Badge tone={status.tone} size="sm" icon={<status.icon />}>
              {status.label}
            </Badge>
            <Text as="h2" variant="title3" weight="semibold" className={styles.title}>
              {charge.title}
            </Text>
            {charge.description && (
              <Text variant="footnote" tone="secondary">
                {charge.description}
              </Text>
            )}
          </section>

          <section className={styles.section} aria-label="Parcelas">
            <header className={styles.sectionHead}>
              <Text as="h3" variant="subheadline" weight="semibold">
                Parcelas
              </Text>
              <Text as="span" variant="caption1" tone="secondary">
                {charge.installments.filter((installment) => installment.paidAt).length} de {charge.installments.length} {outgoing ? "pagas" : "recebidas"}
              </Text>
            </header>
            <ul className={styles.installments}>
              {charge.installments.map((installment) => {
                const state = installmentStatusOf(installment, charge);
                const meta = installmentStatuses[state];
                const busy = busyInstallment === installment.id;
                const reported = !outgoing && installment.reported && !installment.paidAt;
                return (
                  <li key={installment.id} className={styles.installment} data-status={state}>
                    <span className={styles.installmentNumber} aria-hidden="true">
                      {installment.number}
                    </span>
                    <span className={styles.installmentCopy}>
                      <Text as="span" variant="footnote" weight="semibold" numeric>
                        {formatMoney(installment.amount)}
                      </Text>
                      <Text as="span" variant="caption1" tone="secondary">
                        {installment.paidAt
                          ? `${outgoing ? "Paga" : "Recebida"} em ${shortDate(installment.paidAt.slice(0, 10))}${installment.paidMethod ? `, ${chargeMethods[installment.paidMethod].label}` : ""}`
                          : `Vence em ${shortDate(installment.dueDate)}`}
                      </Text>
                    </span>
                    <Badge tone={reported ? "info" : installment.paidAt || charge.cancelledAt ? meta.tone : dueTone(installment.dueDate)} size="sm">
                      {reported ? "Pagamento avisado" : installment.paidAt || charge.cancelledAt ? meta.label : dueLabel(installment.dueDate)}
                    </Badge>
                    {!charge.cancelledAt &&
                      (installment.paidAt ? (
                        onReopen && (
                          <IconButton label={`Reabrir a parcela ${installment.number}`} variant="ghost" size="sm" radius="md" loading={busy} onClick={() => onReopen(installment)}>
                            <ArrowCounterClockwiseIcon />
                          </IconButton>
                        )
                      ) : (
                        onPay && (
                          <span className={styles.installmentAction}>
                            <span className={styles.wide}>
                              <Button variant={reported ? "primary" : "outline"} size="sm" radius="md" iconStart={<CheckCircleIcon />} loading={busy} onClick={() => onPay(installment)}>
                                Confirmar
                              </Button>
                            </span>
                            <span className={styles.narrow}>
                              <IconButton label={`Confirmar o pagamento da parcela ${installment.number}`} variant={reported ? "primary" : "outline"} size="sm" radius="md" loading={busy} onClick={() => onPay(installment)}>
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

          <section className={styles.section} aria-label="Como pagar">
            <Text as="h3" variant="subheadline" weight="semibold">
              {outgoing ? "Como é pago" : "Como o cliente paga"}
            </Text>
            <div className={styles.payment}>
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
                {charge.paymentInfo || (outgoing ? "Sem instruções registradas." : "Sem instruções escritas. O cliente vê só a forma.")}
              </Text>
            </div>
            {charge.notes && (
              <Text variant="footnote" tone="secondary">
                {charge.notes}
              </Text>
            )}
          </section>
        </div>

        <aside className={styles.side} aria-label={`Resumo da ${side.label.toLocaleLowerCase("pt-BR")}`}>
          {payer.clientId ? (
            <Link href={`/${outgoing ? "fornecedores" : "clientes"}/${payer.clientId}` as Route} className={styles.client}>
              <Avatar name={payer.name} src={payer.avatarUrl ?? undefined} size="md" />
              <span className={styles.clientCopy}>
                <Text as="span" variant="footnote" weight="semibold" truncate>
                  {payer.company ?? payer.name}
                </Text>
                <Text as="span" variant="caption1" tone="secondary" truncate>
                  {payer.company ? payer.name : (payer.email ?? "Sem e-mail")}
                </Text>
              </span>
            </Link>
          ) : (
            <div className={styles.client}>
              <Avatar name={payer.name} src={payer.avatarUrl ?? undefined} size="md" />
              <span className={styles.clientCopy}>
                <Text as="span" variant="footnote" weight="semibold" truncate>
                  {payer.name}
                </Text>
                <Text as="span" variant="caption1" tone="secondary" truncate>
                  {outgoing ? "Despesa avulsa" : "Cobrança avulsa"}
                </Text>
              </span>
            </div>
          )}

          {/* Os números num bloco só: o total, a barra do que já entrou ou saiu, e o recebido e o em aberto */}
          <section className={styles.values} aria-label="Valores">
            <Text as="span" variant="caption1" tone="secondary">
              Total
            </Text>
            <Text as="strong" variant="title2" weight="bold" numeric>
              {formatMoney(charge.amount)}
            </Text>
            <Progress variant="bar" value={received} max={charge.amount} size="xs" tone={chargeStatusOf(charge) === "overdue" ? "danger" : outgoing ? "accent" : "success"} aria-label={`${outgoing ? "Pago" : "Recebido"} ${formatMoney(received)} de ${formatMoney(charge.amount)}`} />
            <dl className={styles.split}>
              <div>
                <dt>{outgoing ? "Pago" : "Recebido"}</dt>
                <dd>{formatMoney(received)}</dd>
              </div>
              <div>
                <dt>Em aberto</dt>
                <dd data-tone={chargeStatusOf(charge) === "overdue" ? "danger" : undefined}>{formatMoney(open)}</dd>
              </div>
            </dl>
          </section>

          <dl className={styles.facts}>
            <div>
              <dt>Próxima parcela</dt>
              <dd>{next && !charge.cancelledAt ? shortDate(next.dueDate) : "Nenhuma"}</dd>
            </div>
            <div>
              <dt>Forma</dt>
              <dd>
                <method.icon aria-hidden="true" />
                {method.label}
              </dd>
            </div>
            <div>
              <dt>Parcelas</dt>
              <dd>{charge.installments.length > 1 ? `${charge.installments.length}x` : "À vista"}</dd>
            </div>
            {charge.recurrence !== "none" && (
              <div>
                <dt>Repete</dt>
                <dd>{recurrenceLabels[charge.recurrence]}</dd>
              </div>
            )}
            {charge.quote && (
              <div>
                <dt>Orçamento</dt>
                <dd>{charge.quote.number}</dd>
              </div>
            )}
            {!outgoing && (
              <div>
                <dt>Enviada</dt>
                <dd>{charge.sentAt ? momentLabel(charge.sentAt) : "Ainda não"}</dd>
              </div>
            )}
          </dl>

          <section className={styles.sideBlock} aria-label="Linha do tempo">
            <Text as="h3" variant="subheadline" weight="semibold">
              Linha do tempo
            </Text>
            {/* A linha do tempo da casa, a mesma do histórico de edições (2026-10-27). */}
            <Timeline
              label="Linha do tempo da cobrança"
              entries={events.map((entry) => {
                const meta = eventMeta[entry.kind];
                const what = outgoing && entry.kind === "created" ? "criou a despesa" : outgoing && entry.kind === "cancelled" ? "cancelou a despesa" : eventLabels[entry.kind];
                return { id: entry.id, at: entry.at, icon: meta.icon, hue: meta.hue, title: `${entry.actor ?? "O sistema"} ${what}`, meta: entry.detail };
              })}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
