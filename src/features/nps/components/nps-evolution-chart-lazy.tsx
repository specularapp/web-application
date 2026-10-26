"use client";

import dynamic from "next/dynamic";

export const NpsEvolutionChart = dynamic(() => import("./nps-evolution-chart").then((module) => module.NpsEvolutionChart), {
  ssr: false,
});
