"use client";

import dynamic from "next/dynamic";

// O Recharts sai do pacote inicial da página, como no painel: os gráficos só desenham no cliente.
export const FlowChart = dynamic(() => import("./cash-flow-charts").then((module) => module.FlowChart), { ssr: false });
export const ProjectionChart = dynamic(() => import("./cash-flow-charts").then((module) => module.ProjectionChart), { ssr: false });
export const CategoryDonut = dynamic(() => import("./cash-flow-charts").then((module) => module.CategoryDonut), { ssr: false });
