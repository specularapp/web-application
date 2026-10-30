"use client";

import { ArrowUpRightIcon, CreditCardIcon, DownloadSimpleIcon, FilePdfIcon, LinkIcon, ReceiptIcon } from "@phosphor-icons/react";
import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, DataTableMoney, DataTableStatus, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "@/features/settings/components/settings-page";
import settings from "@/features/settings/components/settings.module.css";
import { cancelSubscriptionAction, confirmPaymentMethodAction, resumeSubscriptionAction, startPaymentMethodUpdateAction } from "../actions";
import { chargeCents, cycleMonths, formatMoney, formatPrice, plans, type BillingCycle } from "../plans";
import type { BillingSeats } from "../queries";
import type { SubscriptionStatus } from "../schemas";
import type { BillingState, Invoice } from "../service";
import { PaymentForm } from "./payment-form";
import { PlanDialog } from "./plan-dialog";
import styles from "./plan-settings.module.css";

type PlanSettingsProps = {
  state: BillingState;
  invoices: Invoice[];
  seats: BillingSeats;
  ai: AiUsage;
};

const statusLabels: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  trialing: { label: "Em teste gratuito", tone: "success" },
  active: { label: "Ativa", tone: "success" },
  past_due: { label: "Pagamento pendente", tone: "warning" },
  incomplete: { label: "Aguardando pagamento", tone: "warning" },
  incomplete_expired: { label: "Expirada", tone: "neutral" },
  unpaid: { label: "Em atraso", tone: "danger" },
  canceled: { label: "Cancelada", tone: "neutral" },
  paused: { label: "Pausada", tone: "neutral" },
};

const invoiceLabels: Record<string, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paga", tone: "success" },
  open: { label: "Em aberto", tone: "warning" },
  draft: { label: "Rascunho", tone: "neutral" },
  void: { label: "Anulada", tone: "neutral" },
  uncollectible: { label: "Não recebida", tone: "danger" },
};

const cycleNames: Record<BillingCycle, string> = { monthly: "Mensal", yearly: "Anual" };

const UNREACHABLE = "Não foi possível falar com o servidor. Confira a conexão e tente de novo.";

const TIMEZONE = "America/Sao_Paulo";

/** Quantos rostos a pilha do plano mostra antes do "+N". */
const FACES = 8;

// Fuso fixo, e não o do processo: este componente é cliente mas também renderiza no servidor, e um
// servidor em UTC escreveria um dia diferente do navegador em Brasília, quebrando a hidratação.
const longDate = (value: string) => format(new Date(value), "d 'de' MMMM 'de' yyyy", { locale: ptBR, in: tz(TIMEZONE) });
const monthOf = (value: string) => format(new Date(value), "MMM. yyyy", { locale: ptBR, in: tz(TIMEZONE) });

/**
 * O plano e a assinatura (2026-09-15; refeita em 2026-10-29, a pedido: "faça a parte de assinatura completa nessa
 * pegada", e no mesmo dia nas peças da casa, a pedido: "está fugindo dos padrões e componentes"). Dois blocos de
 * configuração lado a lado: o plano, com a situação no cabeçalho, o nome e o preço por mês, o time contra o teto de
 * pessoas, os fatos do ciclo e as ações de cancelar ou retomar e de trocar de plano (o `PlanDialog` da casa, que já
 * faz ciclo, teste e pagamento); e a forma de pagamento, com o cartão numa linha da lista e o trocar no cabeçalho.
 * Embaixo, o histórico das faturas na `DataTable`, com o PDF para baixar e o link da fatura online.
 */
export function PlanSettings({ state, invoices, seats, ai }: PlanSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [working, setWorking] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [cardSetup, setCardSetup] = useState<{ clientSecret: string; setupIntentId: string } | null>(null);

  const status = statusLabels[state.status];

  // O título mostra o plano CONTRATADO enquanto existir assinatura no Stripe: em atraso ou pausada o
  // plano em vigor volta a ser o gratuito, e escrever "Gratuito" ali esconderia que há uma assinatura
  // para regularizar. A etiqueta de situação ao lado é quem conta que o acesso não está liberado.
  const shownPlan = state.hasSubscription ? state.plan : state.effectivePlan;
  const currentPlan = plans.find((plan) => plan.id === shownPlan) ?? plans[0];
  const downgraded = state.hasSubscription && state.effectivePlan !== state.plan;
  const scheduled = state.cancelAtPeriodEnd && state.status !== "canceled";
  const paidCycle = state.cycle ?? "monthly";
  const monthly = state.hasSubscription ? Math.round((state.amountCents ?? chargeCents(state.plan, paidCycle)) / cycleMonths[paidCycle]) : currentPlan.price[paidCycle];
  const periodLabel = state.status === "canceled" ? "Encerrou em" : scheduled ? "Acesso até" : "Próxima cobrança";
  const used = seats.members.length;
  const extra = Math.max(0, used - FACES);

  const fail = (description: string) => toast({ title: "Não foi possível concluir", description, tone: "danger" });

  // `finally` em todos: Server Action que rejeita (rede caindo no meio) não pode deixar o painel
  // inteiro travado em loading, sem nenhum caminho de volta a não ser recarregar a página.
  const cancel = async () => {
    if (working) return;
    setWorking("cancel");
    try {
      const result = await cancelSubscriptionAction({ organizationId: state.organizationId });
      if (!result.ok) return fail(result.error);
      setCancelling(false);
      toast({ title: "Assinatura cancelada", description: "Você continua com o plano até o fim do período já pago", tone: "info" });
      router.refresh();
    } catch {
      fail(UNREACHABLE);
    } finally {
      setWorking(null);
    }
  };

  const resume = async () => {
    if (working) return;
    setWorking("resume");
    try {
      const result = await resumeSubscriptionAction({ organizationId: state.organizationId });
      if (!result.ok) return fail(result.error);
      toast({ title: "Assinatura retomada", description: "A renovação volta a acontecer normalmente", tone: "success" });
      router.refresh();
    } catch {
      fail(UNREACHABLE);
    } finally {
      setWorking(null);
    }
  };

  const openCardUpdate = async () => {
    if (working) return;
    setWorking("card");
    try {
      const result = await startPaymentMethodUpdateAction({ organizationId: state.organizationId });
      if (!result.ok) return fail(result.error);
      setCardSetup(result.data);
    } catch {
      fail(UNREACHABLE);
    } finally {
      setWorking(null);
    }
  };

  const confirmCard = async () => {
    if (!cardSetup) return "Recomece a troca do cartão.";
    try {
      const result = await confirmPaymentMethodAction({ organizationId: state.organizationId, setupIntentId: cardSetup.setupIntentId });
      if (!result.ok) return result.error;
      setCardSetup(null);
      toast({ title: "Cartão atualizado", description: "As próximas cobranças usam o novo cartão", tone: "success" });
      router.refresh();
      return null;
    } catch {
      return UNREACHABLE;
    }
  };

  /* O histórico na tabela da casa, como as outras listas: a fatura com o PDF e o mês, a data da cobrança, o valor, a
     situação e, na ponta, o baixar com o leque da fatura online. */
  const columns: DataTableColumn<Invoice>[] = [
    {
      id: "invoice",
      header: "Fatura",
      cell: (invoice) => (
        <DataTableTitle
          title={`Fatura ${invoice.number ?? "sem número"}`}
          caption={`${currentPlan.name}, ${monthOf(invoice.createdAt)}`}
          media={
            <span className={settings.glyph} style={{ "--item-hue": "var(--color-danger)" } as CSSProperties} aria-hidden="true">
              <FilePdfIcon weight="duotone" />
            </span>
          }
        />
      ),
    },
    { id: "date", header: "Data da cobrança", sortable: true, sortValue: (invoice) => invoice.createdAt, cell: (invoice) => <DataTableDate iso={invoice.createdAt} /> },
    {
      id: "amount",
      header: "Valor",
      align: "end",
      sortable: true,
      sortValue: (invoice) => invoice.totalCents,
      cell: (invoice) =>
        invoice.currency.toUpperCase() === "BRL" ? (
          <DataTableMoney cents={invoice.totalCents} />
        ) : (
          <Text as="span" variant="footnote" weight="semibold">
            {formatMoney(invoice.totalCents, invoice.currency)}
          </Text>
        ),
    },
    {
      id: "status",
      header: "Situação",
      cell: (invoice) => {
        const meta = invoiceLabels[invoice.status ?? ""] ?? { label: invoice.status ?? "Desconhecida", tone: "neutral" as const };
        return <DataTableStatus tone={meta.tone}>{meta.label}</DataTableStatus>;
      },
    },
  ];

  const invoiceActions = (invoice: Invoice) => (
    <>
      {invoice.pdfUrl && (
        <Button variant="outline" size="sm" radius="md" iconStart={<DownloadSimpleIcon />} href={invoice.pdfUrl} target="_blank" rel="noreferrer noopener">
          Baixar
        </Button>
      )}
      {invoice.hostedUrl && (
        <DropdownMenu
          label={`Ações da fatura ${invoice.number ?? ""}`}
          triggerLabel={`Abrir ações da fatura ${invoice.number ?? ""}`}
          size="sm"
          sections={[{ id: "actions", items: [{ id: "online", label: "Ver a fatura online", icon: LinkIcon, onSelect: () => window.open(invoice.hostedUrl ?? "", "_blank", "noopener") }] }]}
        />
      )}
    </>
  );

  return (
    <SettingsPage ai={ai}>
      <div className={styles.top}>
        <SettingsSection
          title="Plano atual"
          aside={
            <span className={settings.rowLine}>
              {scheduled && (
                <Badge tone="warning" size="sm">
                  Cancelamento agendado
                </Badge>
              )}
              <Badge tone={status.tone} size="sm">
                {status.label}
              </Badge>
            </span>
          }
        >
          <div className={styles.plan}>
            <div className={settings.rowCopy}>
              <Text as="h3" variant="headline" weight="semibold">
                {currentPlan.name}
              </Text>
              <Text variant="footnote" tone="secondary">
                {currentPlan.description}
              </Text>
            </div>
            <p className={styles.price}>
              <Text as="span" variant="title1" weight="bold">
                {`R$ ${formatPrice(monthly)}`}
              </Text>
              <Text as="span" variant="footnote" tone="secondary">
                {state.hasSubscription && paidCycle === "yearly" ? "por mês, no anual" : "por mês"}
              </Text>
            </p>
          </div>

          <div className={styles.seats}>
            <AvatarGroup>
              {seats.members.slice(0, FACES).map((member, index) => (
                <Avatar key={`${member.name}-${index}`} name={member.name} src={member.avatarUrl ?? undefined} size="sm" />
              ))}
            </AvatarGroup>
            <Text as="span" variant="footnote" tone="secondary">
              {seats.limit === null ? `${used} ${used === 1 ? "pessoa" : "pessoas"} no time` : `${used} de ${seats.limit} ${seats.limit === 1 ? "pessoa" : "pessoas"} do plano`}
              {extra > 0 ? `, ${extra} fora da foto` : ""}
            </Text>
          </div>
          {seats.limit !== null && seats.limit > 0 && (
            <Progress variant="bar" value={Math.min(used, seats.limit)} max={seats.limit} size="xs" tone={used >= seats.limit ? "warning" : "accent"} aria-label={`${used} de ${seats.limit} pessoas do plano`} />
          )}

          <dl className={settings.facts}>
            {state.cycle && (
              <div className={settings.fact}>
                <Text as="dt" variant="footnote" tone="secondary">
                  Ciclo
                </Text>
                <Text as="dd" variant="callout">
                  {cycleNames[state.cycle]}
                </Text>
              </div>
            )}
            {state.trialEnd && state.status === "trialing" && (
              <div className={settings.fact}>
                <Text as="dt" variant="footnote" tone="secondary">
                  Teste termina em
                </Text>
                <Text as="dd" variant="callout">
                  {longDate(state.trialEnd)}
                </Text>
              </div>
            )}
            {state.currentPeriodEnd && (
              <div className={settings.fact}>
                <Text as="dt" variant="footnote" tone="secondary">
                  {periodLabel}
                </Text>
                <Text as="dd" variant="callout">
                  {longDate(state.currentPeriodEnd)}
                </Text>
              </div>
            )}
            {state.hasSubscription && (
              <div className={settings.fact}>
                <Text as="dt" variant="footnote" tone="secondary">
                  Valor do ciclo
                </Text>
                <Text as="dd" variant="callout">
                  {formatMoney(state.amountCents ?? chargeCents(state.plan, paidCycle), state.currency ?? "BRL")}
                </Text>
              </div>
            )}
          </dl>

          {downgraded && (
            <Text variant="footnote" tone="warning" role="status">
              O acesso está no plano gratuito até o pagamento ser regularizado.
            </Text>
          )}

          {state.canManage && (
            <div className={settings.actions}>
              {state.hasSubscription &&
                (state.cancelAtPeriodEnd ? (
                  <Button variant="ghost" size="sm" radius="md" loading={working === "resume"} onClick={() => void resume()}>
                    Retomar assinatura
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" radius="md" onClick={() => setCancelling(true)}>
                    Cancelar assinatura
                  </Button>
                ))}
              <Button variant="outline" size="sm" radius="md" iconEnd={<ArrowUpRightIcon />} onClick={() => setChoosing(true)}>
                {shownPlan === "alliance" ? "Ver planos" : "Fazer upgrade"}
              </Button>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title="Forma de pagamento"
          aside={
            state.canManage && state.hasPaymentMethod && !cardSetup ? (
              <Button variant="outline" size="sm" radius="md" loading={working === "card"} onClick={() => void openCardUpdate()}>
                Trocar cartão
              </Button>
            ) : undefined
          }
        >
          {cardSetup ? (
            <PaymentForm
              clientSecret={cardSetup.clientSecret}
              mode="setup"
              submitLabel="Salvar cartão"
              pendingLabel="Salvando"
              onConfirmed={confirmCard}
              footer={
                <Button type="button" variant="ghost" size="sm" onClick={() => setCardSetup(null)}>
                  Cancelar
                </Button>
              }
            />
          ) : (
            <div className={settings.list}>
              <div className={settings.row}>
                <span className={settings.glyph} style={{ "--item-hue": "var(--sys-indigo)" } as CSSProperties} aria-hidden="true">
                  <CreditCardIcon />
                </span>
                <span className={settings.rowCopy}>
                  {state.hasPaymentMethod ? (
                    <>
                      <span className={settings.rowLine}>
                        <Text as="span" variant="callout" weight="medium">
                          {`${state.paymentBrand ? state.paymentBrand.charAt(0).toUpperCase() + state.paymentBrand.slice(1) : "Cartão"} terminado em ${state.paymentLast4 ?? ""}`}
                        </Text>
                        <Badge tone="neutral" size="sm">
                          Padrão
                        </Badge>
                      </span>
                      <Text as="span" variant="footnote" tone="secondary">
                        Usado nas cobranças da assinatura
                      </Text>
                    </>
                  ) : (
                    <Text as="span" variant="footnote" tone="secondary">
                      Nenhum cartão guardado. Ele é pedido quando você contrata um plano pago.
                    </Text>
                  )}
                </span>
              </div>
              <Text variant="caption1" tone="tertiary">
                O cartão fica guardado no Stripe; a Specular só vê a bandeira e o final.
              </Text>
            </div>
          )}
        </SettingsSection>
      </div>

      <SettingsSection title="Histórico de faturas">
        <DataTable
          label="Faturas da assinatura"
          rows={invoices}
          rowKey={(invoice) => invoice.id}
          columns={columns}
          actions={invoiceActions}
          empty={<EmptyState icon={ReceiptIcon} size="sm" title="Nenhuma fatura por enquanto" description="As faturas aparecem aqui a cada cobrança da assinatura, com o PDF para baixar." />}
        />
      </SettingsSection>

      <PlanDialog
        open={choosing}
        state={state}
        onClose={() => setChoosing(false)}
        onSubscribed={() => {
          setChoosing(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={cancelling}
        pending={working === "cancel"}
        tone="danger"
        title="Cancelar a assinatura?"
        description={`Você continua com o ${currentPlan.name} até ${state.currentPeriodEnd ? longDate(state.currentPeriodEnd) : "o fim do período já pago"}, e depois a conta volta ao plano gratuito. Dá para retomar até lá.`}
        confirmLabel="Cancelar assinatura"
        pendingLabel="Cancelando"
        cancelLabel="Manter assinatura"
        onClose={() => setCancelling(false)}
        onConfirm={() => void cancel()}
      />
    </SettingsPage>
  );
}
