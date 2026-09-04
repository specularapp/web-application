import type { ReactNode } from "react";
import { getOnboardingBilling } from "@/features/billing/queries";
import type { BillingState } from "@/features/billing/service";
import { pickPitch } from "@/features/billing/pitches";
import { planBadges } from "@/features/billing/plans";
import { roleLabels } from "@/features/onboarding/labels";
import { getCurrentTeamState, getTeamOptions } from "@/features/organizations/queries";
import { previewNotifications } from "../notifications/preview";
import { Sidebar, type SidebarPromo } from "../sidebar";
import styles from "./app-shell.module.css";

/* O convite só existe enquanto há o que vender: teste em andamento ou plano gratuito em vigor. A frase
   e o botão são sorteados a cada carga, entre convites que apontam para recursos reais do Pro. */
function promoFor(billing: BillingState): SidebarPromo | undefined {
  const selling = billing.status === "trialing" || billing.effectivePlan === "free";
  if (!selling) return undefined;

  const pitch = pickPitch();
  return {
    eyebrow: "Specular",
    title: billing.status === "trialing" ? "Pro em teste" : "Plano gratuito",
    description: pitch.description,
    action: pitch.action,
    href: "/configuracoes/plano",
  };
}

export async function AppShell({ children }: { children: ReactNode }) {
  const [state, teams] = await Promise.all([getCurrentTeamState(), getTeamOptions()]);
  const billing = await getOnboardingBilling(state.team?.id ?? null);

  const team = {
    name: state.team?.name ?? "Seu time",
    logoUrl: state.team?.logoUrl ?? null,
    plan: planBadges[billing.effectivePlan],
  };

  const user = {
    name: state.viewer.name ?? state.viewer.email ?? "Você",
    email: state.viewer.email,
    role: roleLabels[state.viewer.role],
    avatarUrl: state.viewer.avatarUrl,
  };

  return (
    <div className={styles.shell}>
      <Sidebar
        team={team}
        user={user}
        teams={teams.map((option) => ({
          id: option.id,
          name: option.name,
          logoUrl: option.logoUrl,
          plan: planBadges[option.plan],
        }))}
        currentTeamId={state.team?.id ?? null}
        notifications={previewNotifications}
        promo={promoFor(billing)}
      />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
