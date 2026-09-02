import { z } from "zod";

export const billingPlanSchema = z.enum(["free", "pro", "alliance"]);
export const billingCycleSchema = z.enum(["monthly", "yearly"]);

export const subscriptionStatusSchema = z.enum([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

export type BillingPlan = z.infer<typeof billingPlanSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

const organizationIdSchema = z.object({ organizationId: z.uuid() });

export const organizationScopeSchema = organizationIdSchema;

export const startSubscriptionSchema = z.object({
  organizationId: z.uuid(),
  plan: billingPlanSchema,
  cycle: billingCycleSchema,
});

// O id vem do cliente só para amarrar a confirmação à assinatura que a etapa anterior devolveu; o
// servidor relê tudo no Stripe e confere se aquela assinatura pertence mesmo a esta organização.
export const confirmSubscriptionSchema = z.object({
  organizationId: z.uuid(),
  subscriptionId: z.string().regex(/^sub_[A-Za-z0-9]+$/).optional(),
  setupIntentId: z.string().regex(/^seti_[A-Za-z0-9]+$/).optional(),
});

export const confirmPaymentMethodSchema = z.object({
  organizationId: z.uuid(),
  setupIntentId: z.string().regex(/^seti_[A-Za-z0-9]+$/),
});

export type StartSubscriptionInput = z.infer<typeof startSubscriptionSchema>;
export type ConfirmSubscriptionInput = z.infer<typeof confirmSubscriptionSchema>;
export type ConfirmPaymentMethodInput = z.infer<typeof confirmPaymentMethodSchema>;
export type OrganizationScopeInput = z.infer<typeof organizationScopeSchema>;
