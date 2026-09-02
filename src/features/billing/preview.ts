import type { BillingState, Invoice, PlanOffer } from "./service";

// Estado de cobrança de mentira, para a vitrine e para a prévia de front. Fica aqui, e não em cada
// tela, para as duas mostrarem o mesmo catálogo: teste gratuito de 7 dias no Pro, nada no resto.
export const previewOffers: PlanOffer[] = [
  {
    id: "free",
    tier: 0,
    isPaid: false,
    trialDays: 0,
    trialRequiresPaymentMethod: false,
    trialAvailable: false,
    cycles: [],
  },
  {
    id: "pro",
    tier: 1,
    isPaid: true,
    trialDays: 7,
    trialRequiresPaymentMethod: true,
    trialAvailable: true,
    cycles: ["monthly", "yearly"],
  },
  {
    id: "alliance",
    tier: 2,
    isPaid: true,
    trialDays: 0,
    trialRequiresPaymentMethod: true,
    trialAvailable: false,
    cycles: ["monthly", "yearly"],
  },
];

/** Quem acabou de entrar: gratuito em vigor e o teste do Pro ainda por usar. */
export const previewBillingState: BillingState = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  plan: "free",
  effectivePlan: "free",
  status: "active",
  cycle: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEnd: null,
  paymentBrand: null,
  paymentLast4: null,
  hasPaymentMethod: false,
  hasSubscription: false,
  amountCents: null,
  currency: null,
  canManage: true,
  offers: previewOffers,
};

/** Assinatura do Pro em teste gratuito, com cartão guardado. É o estado com mais campos preenchidos. */
export const previewSubscribedState: BillingState = {
  ...previewBillingState,
  plan: "pro",
  effectivePlan: "pro",
  status: "trialing",
  cycle: "monthly",
  currentPeriodEnd: "2026-09-08T12:00:00.000Z",
  trialEnd: "2026-09-08T12:00:00.000Z",
  paymentBrand: "visa",
  paymentLast4: "4242",
  hasPaymentMethod: true,
  hasSubscription: true,
  amountCents: 9700,
  currency: "brl",
  offers: previewOffers.map((offer) => (offer.id === "pro" ? { ...offer, trialAvailable: false } : offer)),
};

export const previewInvoices: Invoice[] = [
  {
    id: "in_preview_2",
    number: "SPEC-0002",
    status: "open",
    totalCents: 9700,
    currency: "brl",
    createdAt: "2026-09-01T12:00:00.000Z",
    hostedUrl: null,
    pdfUrl: null,
  },
  {
    id: "in_preview_1",
    number: "SPEC-0001",
    status: "paid",
    totalCents: 9700,
    currency: "brl",
    createdAt: "2026-08-01T12:00:00.000Z",
    hostedUrl: null,
    pdfUrl: null,
  },
];
