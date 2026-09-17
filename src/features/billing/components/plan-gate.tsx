"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { loadBillingStateAction } from "../actions";
import type { PlanId } from "../plans";
import type { BillingState } from "../service";
import { PlanDialog } from "./plan-dialog";

/**
 * O portão de plano da aplicação inteira.
 *
 * Toda ação que pede um plano pergunta aqui antes de acontecer. Liberada, ela segue; bloqueada, o modal
 * central abre dizendo o que faltou, e a pessoa assina sem sair de onde estava. É o que faz o bloqueio ser
 * um convite, e não um beco: antes disso o selo do plano no menu só decorava a linha, e clicar nela levava
 * a pessoa para uma tela que não explicava nada.
 *
 * O estado de cobrança **não** vem com a concha: ele é buscado na primeira vez que alguém esbarra num
 * bloqueio, como as conversas do assistente. Quem nunca esbarra não paga por essa leitura.
 */
type PlanGateValue = {
  /** O plano em vigor, que vem da concha e já saiu do banco por `organization_plan`. */
  plan: PlanId;
  /** Se o plano em vigor alcança o exigido. Puro: não abre nada. */
  allows: (required: PlanId) => boolean;
  /**
   * Libera ou abre o modal de planos. Devolve `true` quando a ação pode seguir, e é por isso que ele se lê
   * como uma condição: `if (!require("pro")) return;`.
   */
  require: (required: PlanId) => boolean;
};

const PlanGateContext = createContext<PlanGateValue | null>(null);

/* O degrau de cada plano: `alliance` alcança `pro`, que alcança `free`. É a mesma ordem de `billing_plans`. */
const tiers: Record<PlanId, number> = { free: 0, pro: 1, alliance: 2 };

export function PlanGateProvider({ plan, children }: { plan: PlanId; children: ReactNode }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<BillingState | null>(null);
  const asked = useRef(false);

  const allows = useCallback((required: PlanId) => tiers[plan] >= tiers[required], [plan]);

  const require = useCallback(
    (required: PlanId) => {
      if (allows(required)) return true;

      setAsking(true);

      /* A primeira abertura busca o estado de cobrança; as seguintes reaproveitam o que já veio. */
      if (!asked.current) {
        asked.current = true;
        void loadBillingStateAction()
          .then(setState)
          .catch(() => {
            /* Falhou a busca: a próxima abertura tenta de novo em vez de ficar girando para sempre. */
            asked.current = false;
          });
      }

      return false;
    },
    [allows],
  );

  const value = useMemo<PlanGateValue>(() => ({ plan, allows, require }), [plan, allows, require]);

  return (
    <PlanGateContext.Provider value={value}>
      {children}
      <PlanDialog
        open={asking}
        state={state}
        onClose={() => setAsking(false)}
        onSubscribed={() => {
          /* O plano em vigor vem da concha, que é servidor: sem refazer a rota, a mesma ação continuaria
             bloqueada logo depois de a pessoa assinar. O estado de cobrança também é largado, para a
             próxima abertura ler o novo em vez do de antes. */
          setAsking(false);
          setState(null);
          asked.current = false;
          router.refresh();
        }}
      />
    </PlanGateContext.Provider>
  );
}

/**
 * O portão, para quem precisa dele. Fora do provedor ele libera tudo: a vitrine de componentes e as telas
 * públicas não têm plano, e travar ali seria travar quem não tem conta.
 */
export function usePlanGate(): PlanGateValue {
  const gate = useContext(PlanGateContext);
  return gate ?? open;
}

const open: PlanGateValue = { plan: "alliance", allows: () => true, require: () => true };
