"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { crmStageMeta, stageMetadata, type CrmStageDefinition } from "../stages";
import type { CrmFunnel } from "../tree";

const StageContext = createContext(crmStageMeta);
const FunnelContext = createContext<CrmFunnel[]>([]);

export function CrmStageProvider({ definitions, funnels, children }: { definitions: CrmStageDefinition[]; funnels: CrmFunnel[]; children: ReactNode }) {
  const value = useMemo(() => stageMetadata(definitions), [definitions]);
  return <FunnelContext.Provider value={funnels}><StageContext.Provider value={value}>{children}</StageContext.Provider></FunnelContext.Provider>;
}

export const useCrmStages = () => useContext(StageContext);
export function useFunnelStages(slug: string | undefined, fallback: string[] | undefined) {
  return useContext(FunnelContext).find((funnel) => funnel.slug === slug)?.stages ?? fallback;
}
