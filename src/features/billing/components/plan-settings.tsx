"use client";

import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Surface } from "@/components/ui/surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { Text } from "@/components/ui/text";
import {
  cancelSubscriptionAction,
  confirmPaymentMethodAction,
  resumeSubscriptionAction,
  startPaymentMethodUpdateAction,
  startSubscriptionAction,
} from "../actions";
import {
  chargeCents,
  formatMoney,
  formatPrice,
  plans,
  type BillingCycle,
  type PlanId,
} from "../plans";
import type { BillingState, Invoice } from "../service";
import type { SubscriptionStatus } from "../schemas";
import { CheckoutPanel, type CheckoutIntentInfo } from "./checkout-panel";
import { CycleToggle } from "./cycle-toggle";
import { PaymentForm } from "./payment-form";
import styles from "./plan-settings.module.css";

type PlanSettingsProps = {
  state: BillingState;
  invoices: Invoice[];
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

const invoiceLabels: Record<string, string> = {
  paid: "Paga",
  open: "Em aberto",
  draft: "Rascunho",
  void: "Anulada",
  uncollectible: "Não recebida",
};

const cycleNames: Record<BillingCycle, string> = { monthly: "Mensal", yearly: "Anual" };

const UNREACHABLE = "Não foi possível falar com o servidor. Confira a conexão e tente de novo.";

const TIMEZONE = "America/Sao_Paulo";

// Fuso fixo, e não o do processo: este componente é cliente mas também renderiza no servidor, e um
// servidor em UTC escreveria um dia diferente do navegador em Brasília, quebrando a hidratação.
function shortDate(value: string) {
  return format(new Date(value), "d 'de' MMMM 'de' yyyy", { locale: ptBR, in: tz(TIMEZONE) });
}

export function PlanSettings({ state, invoices }: PlanSettingsProps) {
  const { toast } = useToast();
  const [cycle, setCycle] = useState<BillingCycle>(state.cycle ?? "monthly");
  const [working, setWorking] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutIntentInfo | null>(null);
  const [cardSetup, setCardSetup] = useState<{ clientSecret: string; setupIntentId: string } | null>(null);

  const status = statusLabels[state.status];

  // O título mostra o plano CONTRATADO enquanto existir assinatura no Stripe: em atraso ou pausada o
  // plano em vigor volta a ser o gratuito, e escrever "Gratuito" ali esconderia que há uma assinatura
  // para regularizar. A etiqueta de situação ao lado é quem conta que o acesso não está liberado.
  const shownPlan = state.hasSubscription ? state.plan : state.effectivePlan;
  const currentPlan = plans.find((plan) => plan.id === shownPlan);
  const downgraded = state.hasSubscription && state.effectivePlan !== state.plan;
  const scheduled = state.cancelAtPeriodEnd && state.status !== "canceled";
  const periodLabel = state.status === "canceled" ? "Encerrou em" : scheduled ? "Acesso até" : "Próxima cobrança";
  const paidCycle = state.cycle ?? "monthly";

  const trialDaysOf = (planId: PlanId) => {
    const offer = state.offers.find((item) => item.id === planId);
    return offer?.trialAvailable ? offer.trialDays : 0;
  };

  const fail = (description: string) =>
    toast({ title: "Não foi possível concluir", description, tone: "danger" });

  // `finally` em todos: Server Action que rejeita (rede caindo no meio) não pode deixar o painel
  // inteiro travado em loading, sem nenhum caminho de volta a não ser recarregar a página.
  const choosePlan = async (planId: PlanId) => {
    if (working) return;
    setWorking(planId);

    try {
      const result = await startSubscriptionAction({ organizationId: state.organizationId, plan: planId, cycle });

      if (!result.ok) {
        fail(result.error);
        return;
      }

      if (result.data.kind === "payment") {
        setCheckout(result.data);
        return;
      }

      toast({
        title: "Plano atualizado",
        description:
          planId === "free"
            ? "A assinatura fica ativa até o fim do período já pago"
            : "Tudo certo, o novo plano já está valendo",
        tone: "success",
      });
    } catch {
      fail(UNREACHABLE);
    } finally {
      setWorking(null);
    }
  };

  const cancel = async () => {
    if (working) return;
    setWorking("cancel");

    try {
      const result = await cancelSubscriptionAction({ organizationId: state.organizationId });

      if (!result.ok) {
        fail(result.error);
        return;
      }

      setConfirmingCancel(false);
      toast({
        title: "Assinatura cancelada",
        description: "Você continua com o plano até o fim do período já pago",
        tone: "info",
      });
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

      if (!result.ok) {
        fail(result.error);
        return;
      }

      toast({
        title: "Assinatura retomada",
        description: "A renovação volta a acontecer normalmente",
        tone: "success",
      });
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

      if (!result.ok) {
        fail(result.error);
        return;
      }

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
      const result = await confirmPaymentMethodAction({
        organizationId: state.organizationId,
        setupIntentId: cardSetup.setupIntentId,
      });

      if (!result.ok) return result.error;

      setCardSetup(null);
      toast({ title: "Cartão atualizado", description: "As próximas cobranças usam o novo cartão", tone: "success" });
      return null;
    } catch {
      return UNREACHABLE;
    }
  };

  if (checkout) {
    return (
      <Container>
        <div className={styles.page}>
          <header className={styles.head}>
            <Text as="h1" variant="title1" weight="semibold">
              Plano e assinatura
            </Text>
          </header>

          <CheckoutPanel
            organizationId={state.organizationId}
            intent={checkout}
            title={checkout.trialDays > 0 ? "Guarde um cartão para começar" : "Confirme o pagamento"}
            description={
              checkout.trialDays > 0
                ? "Nada é cobrado agora. O cartão fica guardado para a assinatura seguir quando o teste terminar."
                : "A troca de plano entra em vigor assim que o pagamento for confirmado."
            }
            backLabel="Voltar para o plano"
            onBack={() => setCheckout(null)}
            onDone={() => {
              setCheckout(null);
              toast({ title: "Plano atualizado", description: "Tudo certo, aproveite", tone: "success" });
            }}
          />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className={styles.page}>
        <header className={styles.head}>
          <Text as="h1" variant="title1" weight="semibold">
            Plano e assinatura
          </Text>
          <Text variant="subheadline" tone="secondary">
            Acompanhe o que está contratado, troque de plano e cuide da forma de pagamento.
          </Text>
        </header>

        <Surface as="section" className={styles.section} aria-labelledby="plano-atual">
          <div className={styles.summary}>
            <div className={styles.summaryTop}>
              <Text as="h2" id="plano-atual" variant="title3" weight="semibold">
                {currentPlan?.name ?? "Gratuito"}
              </Text>
              <Badge tone={status.tone} size="sm">
                {status.label}
              </Badge>
              {scheduled && (
                <Badge tone="warning" size="sm">
                  Cancelamento agendado
                </Badge>
              )}
            </div>

            <dl className={styles.facts}>
              {state.cycle && (
                <div className={styles.fact}>
                  <Text as="dt" variant="footnote" tone="secondary">
                    Ciclo
                  </Text>
                  <Text as="dd" variant="callout">
                    {cycleNames[state.cycle]}
                  </Text>
                </div>
              )}

              {state.trialEnd && state.status === "trialing" && (
                <div className={styles.fact}>
                  <Text as="dt" variant="footnote" tone="secondary">
                    Teste termina em
                  </Text>
                  <Text as="dd" variant="callout">
                    {shortDate(state.trialEnd)}
                  </Text>
                </div>
              )}

              {state.currentPeriodEnd && (
                <div className={styles.fact}>
                  <Text as="dt" variant="footnote" tone="secondary">
                    {periodLabel}
                  </Text>
                  <Text as="dd" variant="callout">
                    {shortDate(state.currentPeriodEnd)}
                  </Text>
                </div>
              )}

              {state.hasSubscription && (
                <div className={styles.fact}>
                  <Text as="dt" variant="footnote" tone="secondary">
                    Valor
                  </Text>
                  <Text as="dd" variant="callout" numeric>
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

            {state.canManage && state.hasSubscription && (
              <div className={styles.actions}>
                {state.cancelAtPeriodEnd ? (
                  <Button variant="secondary" size="sm" loading={working === "resume"} onClick={() => void resume()}>
                    Retomar assinatura
                  </Button>
                ) : confirmingCancel ? (
                  <>
                    <Button variant="danger" size="sm" loading={working === "cancel"} onClick={() => void cancel()}>
                      Confirmar cancelamento
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
                      Manter assinatura
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(true)}>
                    Cancelar assinatura
                  </Button>
                )}
              </div>
            )}
          </div>
        </Surface>

        {state.canManage && (
          <section className={styles.section} aria-labelledby="trocar-plano">
            <div className={styles.sectionHead}>
              <Text as="h2" id="trocar-plano" variant="title3" weight="semibold">
                Trocar de plano
              </Text>

              <CycleToggle value={cycle} onChange={setCycle} />
            </div>

            <div className={styles.options}>
              {plans.map((plan) => {
                // Plano atual só quando o ciclo também bate: sem isso quem está no mensal ficava com o
                // botão do anual desabilitado e não tinha caminho nenhum para trocar de ciclo.
                const samePlan = plan.id === shownPlan;
                const isCurrent = samePlan && (plan.id === "free" || paidCycle === cycle);

                return (
                  <Surface key={plan.id} tone={isCurrent ? "sunken" : "raised"}>
                    <div className={styles.option}>
                      <div className={styles.optionHead}>
                        <Text as="h3" variant="headline" weight="semibold">
                          {plan.name}
                        </Text>
                        {trialDaysOf(plan.id) > 0 && (
                          <Badge tone="success" size="sm">
                            {trialDaysOf(plan.id)} dias grátis
                          </Badge>
                        )}
                      </div>

                      <Text variant="footnote" tone="secondary">
                        {plan.description}
                      </Text>

                      <p className={styles.optionPrice}>
                        <span className={styles.optionAmount}>R${formatPrice(plan.price[cycle])}</span>
                        <span className={styles.optionPeriod}>/mês</span>
                      </p>

                      <Button
                        variant={isCurrent ? "secondary" : "primary"}
                        size="sm"
                        fullWidth
                        radius="md"
                        disabled={isCurrent}
                        loading={working === plan.id}
                        onClick={() => void choosePlan(plan.id)}
                      >
                        {isCurrent
                          ? "Plano atual"
                          : samePlan
                            ? `Trocar para ${cycleNames[cycle].toLowerCase()}`
                            : trialDaysOf(plan.id) > 0
                              ? `Testar ${trialDaysOf(plan.id)} dias`
                              : plan.id === "free"
                                ? "Voltar para o gratuito"
                                : "Assinar"}
                      </Button>
                    </div>
                  </Surface>
                );
              })}
            </div>
          </section>
        )}

        <Surface as="section" className={styles.section} aria-labelledby="forma-de-pagamento">
          <Text as="h2" id="forma-de-pagamento" variant="title3" weight="semibold">
            Forma de pagamento
          </Text>

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
            <div className={styles.card}>
              <div className={styles.cardInfo}>
                {state.hasPaymentMethod ? (
                  <>
                    <Text variant="callout">
                      <span className={styles.brand}>{state.paymentBrand ?? "Cartão"}</span> terminado em{" "}
                      {state.paymentLast4}
                    </Text>
                    <Text variant="footnote" tone="secondary">
                      Usado nas cobranças da assinatura
                    </Text>
                  </>
                ) : (
                  <Text variant="footnote" tone="secondary">
                    Nenhum cartão guardado. Ele é pedido quando você contrata um plano pago.
                  </Text>
                )}
              </div>

              {state.canManage && state.hasPaymentMethod && (
                <Button variant="secondary" size="sm" loading={working === "card"} onClick={() => void openCardUpdate()}>
                  Trocar cartão
                </Button>
              )}
            </div>
          )}
        </Surface>

        <section className={styles.section} aria-labelledby="faturas">
          <Text as="h2" id="faturas" variant="title3" weight="semibold">
            Faturas
          </Text>

          {invoices.length === 0 ? (
            <Text variant="footnote" tone="secondary" className={styles.empty}>
              Nenhuma fatura por enquanto.
            </Text>
          ) : (
            <TableScroll label="Faturas da assinatura">
              <Table density="compact">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Fatura</TableHeaderCell>
                    <TableHeaderCell>Data</TableHeaderCell>
                    <TableHeaderCell>Situação</TableHeaderCell>
                    <TableHeaderCell align="end">Valor</TableHeaderCell>
                    <TableHeaderCell align="end">Arquivo</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number ?? "Sem número"}</TableCell>
                      <TableCell>{shortDate(invoice.createdAt)}</TableCell>
                      <TableCell>{invoiceLabels[invoice.status ?? ""] ?? invoice.status ?? "Desconhecida"}</TableCell>
                      <TableCell align="end">{formatMoney(invoice.totalCents, invoice.currency)}</TableCell>
                      <TableCell align="end">
                        {invoice.pdfUrl ? (
                          <a className={styles.link} href={invoice.pdfUrl} target="_blank" rel="noreferrer noopener">
                            Baixar PDF
                          </a>
                        ) : (
                          <Text as="span" variant="footnote" tone="tertiary">
                            Sem arquivo
                          </Text>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </section>
      </div>
    </Container>
  );
}
